const mysql = require('mysql');

// MySQL Database connection pool configuration



const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'blood_donation',
});


// const pool = mysql.createPool({
//   connectionLimit: 10,
//   host: process.env.HOST,
//   user: process.env.USER,
//   password: process.env.PASSWORD,
//   database: process.env.DATABASE,
// });




/// Create 'doctor' table if not exists
const createDoctorTableQuery = `
CREATE TABLE IF NOT EXISTS doctor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_name VARCHAR(255),
  doc_add VARCHAR(255),
  doc_phno VARCHAR(255)
)
`;

// Create 'donor' table if not exists
const createDonorTableQuery = `
CREATE TABLE IF NOT EXISTS donor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_name VARCHAR(255),
  phone_no VARCHAR(255),
  DOB DATE,
  gender VARCHAR(10),
  address VARCHAR(255),
  weight FLOAT,
  blood_pressure FLOAT,
  iron_content FLOAT,
  doctor_id INT,
  FOREIGN KEY (doctor_id) REFERENCES doctor(id) ON DELETE CASCADE
)
`;


const createPatientTableQuery = `
CREATE TABLE IF NOT EXISTS patient (
  patient_id INT NOT NULL AUTO_INCREMENT,
  patient_name VARCHAR(20),
  p_phno VARCHAR(255),
  h_add VARCHAR(50),
  p_add VARCHAR(50),
  PRIMARY KEY (patient_id)
)
`;

const createBloodBankTableQuery = `
CREATE TABLE IF NOT EXISTS blood_bank (
  blood_bank_id INT NOT NULL AUTO_INCREMENT,
  blood_bank_name VARCHAR(50),
  baddress VARCHAR(255),
  PRIMARY KEY (blood_bank_id)
  
)
`;

const createBloodTableQuery = `
CREATE TABLE IF NOT EXISTS blood (
  blood_type VARCHAR(20),
  donor_id INT,
  blood_bank_id INT,
  PRIMARY KEY (donor_id),
  blood_date DATE,
  FOREIGN KEY (donor_id) REFERENCES donor(id) ON DELETE CASCADE,
  FOREIGN KEY (blood_bank_id) REFERENCES blood_bank(blood_bank_id) ON DELETE CASCADE
)
`;

const createBloodDeliveryTableQuery = `
CREATE TABLE IF NOT EXISTS blood_delivery (
  delivery_id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_date DATE,
  donor_id INT,
  patient_id INT,
  blood_type VARCHAR(20),
  blood_bank_id INT
)
`;



// Execute table creation queries
executeQuery(createDoctorTableQuery, null, 0);
executeQuery(createDonorTableQuery, null, 0);
executeQuery(createBloodBankTableQuery, null, 0);
executeQuery(createBloodTableQuery, null, 0);
executeQuery(createPatientTableQuery, null, 0);
executeQuery(createBloodDeliveryTableQuery, null, 0);






function executeQuery(query, res, callback, retryCount = 3) {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection:', err.message);
      // Retry logic
      if (retryCount > 0) {
        console.log(`Retrying (${retryCount} attempts left)`);
        executeQuery(query, res, callback, retryCount - 1);
      } else {
        res.status(500).send('Error getting MySQL connection');
      }
      return;
    }

    connection.query(query, (error, results) => {
      connection.release(); // Release the connection back to the pool

      if (error) {
        console.error('Error executing query:', error.message);
        // Retry logic
        if (retryCount > 0) {
          console.log(`Retrying (${retryCount} attempts left)`);
          executeQuery(query, res, callback, retryCount - 1);
        } else {
          res.status(500).send('Error executing query');
        }
        return;
      }

      console.log('Query executed successfully');
      // Invoke the callback with the results
      if (typeof callback === 'function') {
        callback(results);
      } else if (res) {
        res.redirect('/index');
      }
    });
  });
}


module.exports = { mysql, pool, executeQuery }