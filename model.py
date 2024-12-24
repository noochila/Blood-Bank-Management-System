import pymysql
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from prettytable import PrettyTable
from sqlalchemy import create_engine


# Database connection
def get_donor_data():
    # Create SQLAlchemy engine
    engine = create_engine("mysql+pymysql://root:root@localhost/blood_donation")
    query = "SELECT donor_name, phone_no, DOB, gender, address, weight, blood_pressure, iron_content FROM donor"
    donor_data = pd.read_sql(query, engine)
    return donor_data


def preprocess_data(donor_data):
    donor_data = donor_data.copy()

    # Convert DOB to age
    donor_data['age'] = pd.to_datetime('today').year - pd.to_datetime(donor_data['DOB']).dt.year

    # Drop unnecessary columns but keep relevant ones
    donor_data = donor_data.drop(columns=['DOB', 'phone_no', 'address'])

    # Encode gender as binary
    donor_data['gender'] = donor_data['gender'].map({'Male' or 'M': 0, 'Female' or 'F': 1})

    # Define eligibility (target variable)
    donor_data['eligible'] = ((donor_data['age'] > 18) &
                              (donor_data['weight'] > 50) &
                              (donor_data['blood_pressure'] < 120) &
                              (donor_data['iron_content'] > 12)).astype(int)

    # Separate features and target
    X = donor_data.drop(columns=['eligible', 'donor_name'])  # Exclude non-numeric columns like 'donor_name'
    y = donor_data['eligible']

    return X, y, donor_data

def train_model(X, y):
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    model = RandomForestClassifier(random_state=42)
    model.fit(X_train, y_train)
    return model, X_test

def display_predictions(model, X, donor_data):
    # Predict for all donors (use X instead of X_test)
    predictions = model.predict(X)

    # Retain donor_name for display and add predictions
    donor_data['eligibility_prediction'] = predictions

    # Display in table format
    table = PrettyTable()
    table.field_names = ["Donor Name", "Age", "Gender", "Weight", "Blood Pressure", "Iron Content", "Eligibility"]

    for index, row in donor_data.iterrows():
        table.add_row([ 
            row['donor_name'],
            row['age'],
            "Male" or "M" if row['gender'] == 0 else "Female" or "F",
            row['weight'],
            row['blood_pressure'],
            row['iron_content'],
            "Eligible" if row['eligibility_prediction'] == 1 else "Not Eligible"
        ])

    print(table)


# Main execution
if __name__ == "__main__":
    # Step 1: Get donor data
    donor_data = get_donor_data()

    # Step 2: Preprocess data
    X, y, donor_data = preprocess_data(donor_data)

    # Step 3: Train the model
    model, X_test = train_model(X, y)

    # Step 4: Display predictions
    display_predictions(model, X, donor_data)
