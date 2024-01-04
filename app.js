const express = require('express');

const bodyParser = require('body-parser');
const path = require("path")
const fs = require('fs');
const { log } = require('console');

const {Donorfeedback}=require("./mongodb")

const {mysql,pool,executeQuery}=require("./mysql")

const app = express();
const port = 3000;
const temporaryStorage = [];

// Use middleware to parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));



app.get("/admin", (req, res) => {
    res.sendFile(__dirname + "/Front-end/admin.html")
})

app.get("/donor", (req, res) => {
    res.sendFile(__dirname + "/Front-end/donor.html")
})
app.post('/donor',  (req, res) => {

    // console.log(req.body);
    const {
        donor_name,
        phone_no,
        DOB,
        gender,
        address,
        weight,
        blood_pressure,
        iron_content,
        doctor_id,
        blood_bank_id,
        blood_type,
        donor_report
    } = req.body;

    // Insert into donor table

    const donorQuery = `
  INSERT INTO donor (donor_name, phone_no, DOB, gender, address, weight, blood_pressure, iron_content, doctor_id)
  VALUES ('${donor_name}', '${phone_no}', '${DOB}', '${gender}', '${address}', '${weight}', '${blood_pressure}', '${iron_content}', '${doctor_id}')
`;

    // executeQuery(donorQuery, res) ;
    let id;
    executeQuery(donorQuery, res, (donorResult) => {
        id = donorResult.insertId;
        console.log('Inserted donor ID:', id);

        // Now you can use donorId for further operations

        const bloodQuery = `
    INSERT INTO blood (blood_bank_id, blood_type, donor_id)
    VALUES ('${blood_bank_id}', '${blood_type}', '${id}');
  `;
     Donorfeedback.create({key:id,report:donor_report})
        // Execute the blood query
        executeQuery(bloodQuery, res);
    });

       

  

});


app.get("/patient", (req, res) => {
    res.sendFile(__dirname + "/Front-end/patient.html")

})



app.post("/patient", (req, res) => {

    const { patient_name, p_phno, h_add, p_add, blood_type, blood_bank_id } = req.body;

    // Check if the required blood is present in the specified blood bank
    const checkBloodAvailabilityQuery = `
      SELECT donor.id, donor.donor_name, donor.phone_no, donor.address as donor_address, blood.blood_type, blood_bank.blood_bank_name
      FROM blood
      JOIN donor ON blood.donor_id = donor.id
      JOIN blood_bank ON blood.blood_bank_id = blood_bank.blood_bank_id
      WHERE blood.blood_type = ? AND blood.blood_bank_id = ?
    `;

    pool.query(checkBloodAvailabilityQuery, [blood_type, blood_bank_id], (error, donorResults) => {
        if (error) {
            console.error('Error checking blood availability:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (donorResults.length > 0) {
            // Blood is available, provide details of matching donors
            const donorDetails = donorResults.map((donor) => ({
                donor_id: donor.id,
                donor_name: donor.donor_name,
                phone_no: donor.phone_no,
                donor_address: donor.donor_address,
                blood_type: donor.blood_type,
                blood_bank_name: donor.blood_bank_name,
            }));

            // Save patient details only when the donor is available
            const savePatientQuery = `
          INSERT INTO patient (patient_name, p_phno, h_add, p_add)
          VALUES (?, ?, ?, ?)
        `;

            pool.query(savePatientQuery, [patient_name, p_phno, h_add, p_add], (savePatientError, savePatientResults) => {
                if (savePatientError) {
                    console.error('Error saving patient details:', savePatientError);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                // Redirect to the /selectDonor route with patient and donor details as query parameters
                res.redirect(`/selectDonor?patient_name=${encodeURIComponent(patient_name)}&p_phno=${encodeURIComponent(p_phno)}&h_add=${encodeURIComponent(h_add)}&p_add=${encodeURIComponent(p_add)}&blood_type=${encodeURIComponent(blood_type)}&donorDetails=${encodeURIComponent(JSON.stringify(donorDetails))}`);

            });
        } else {
            // Blood is not available in the specified blood bank for the required type
            res.send('Blood not available in the specified blood bank for the required type.');
        }
    });
});


app.get("/selectDonor", (req, res) => {
    // console.log(req.query);
    temporaryStorage.push(req.query)
    res.sendFile(__dirname + "/Front-end/selectDonor.html")
})
app.post("/selectDonor", (req, res) => {
    const { donor_id } = req.body;
    // console.log(donor_id);
    
  
    // Fetch patient details from req.query
    const { patient_name, p_phno, h_add, p_add, blood_type, donorDetails } = temporaryStorage.pop();
    const parsedDonorDetails = JSON.parse(decodeURIComponent(donorDetails));
  
    // Get details of the selected donor
    // console.log("Parsed Donor Details:", parsedDonorDetails);

    // Get details of the selected donor
    let selectedDonor;
    for (const donor of parsedDonorDetails) {
      if (String(donor.donor_id) === String(donor_id).trim()) {
        selectedDonor = donor;
        break;
      }
    }
    console.log(selectedDonor);
    // Delete the row from the blood table where donor_id matches
    const deleteBloodQuery = `
      DELETE FROM blood
      WHERE donor_id = ?
    `;
  
    pool.query(deleteBloodQuery, [donor_id], (deleteError) => {
      if (deleteError) {
        console.error('Error deleting row from blood table:', deleteError);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
  
      // Now, delete the donor details from the donor table
      const deleteDonorDetailsQuery = `
        DELETE FROM donor
        WHERE id = ?
      `;
  
      pool.query(deleteDonorDetailsQuery, [donor_id], (deleteDonorError) => {
        if (deleteDonorError) {
          console.error('Error deleting donor details:', deleteDonorError);
          res.status(500).json({ error: 'Internal Server Error' });
          return;
        }
  
        // Redirect to the /generateBill route with patient and donor details as query parameters
       // In the /selectDonor route, where you redirect to /generateBill
res.redirect(`/generateBill?patient_name=${encodeURIComponent(patient_name)}&p_phno=${encodeURIComponent(p_phno)}&h_add=${encodeURIComponent(h_add)}&p_add=${encodeURIComponent(p_add)}&donor_id=${donor_id}&blood_type=${encodeURIComponent(blood_type)}&DonorDetails=${encodeURIComponent(JSON.stringify(selectedDonor))}`);

      });
    });
  });
  

app.get("/sendDonor", (req, res) => {
    // Render the sendDonor.html file
    res.sendFile(path.join(__dirname,'/Front-end/sendDonor.html'));
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/Front-end/index.html');
});

app.post('/addDoctor', (req, res) => {
    const { doctor_name, doc_add, doc_phno } = req.body;




    const query = `
    INSERT INTO doctor (doctor_name, doc_add, doc_phno)
    VALUES ('${doctor_name}', '${doc_add}', ${doc_phno})
  `;

    executeQuery(query, res);

});


app.post('/bloodbank', (req, res) => {
    const {
        blood_bank_name,
        baddress
    } = req.body;

    // Parse the string into a JavaScript Date object



    const query = `
    INSERT INTO blood_bank (blood_bank_name,baddress) VALUES (
      '${blood_bank_name}', 
      '${baddress}'

    );
  `;

    executeQuery(query, res);

});

app.get('/getDoctors', (req, res) => {
    const query = 'SELECT id, doctor_name FROM doctor';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});

app.get('/getBloodBank', (req, res) => {
    const query = 'SELECT blood_bank_id, blood_bank_name FROM blood_bank';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});

// Add this code after your existing routes

app.get('/generateBill', (req, res) => {
    const {
        patient_name,
        p_phno,
        h_add,
        p_add,
        donor_id,
        blood_type,
        DonorDetails
    } = req.query;

    // Parse DonorDetails back into an object
    const parsedDonorDetails = JSON.parse(DonorDetails);

    // Access donor details from the parsed object
    const {
        donor_name,
        phone_no,
        donor_address,
        blood_bank_name
    } = parsedDonorDetails;

    log(req.query)
    log(parsedDonorDetails)


    // Render the generateBill.html file with the provided data
    const generateBillTemplatePath = path.join(__dirname, '/Front-end/generateBill.html');
    const generateBillTemplate = fs.readFileSync(generateBillTemplatePath, 'utf-8');

    const generateBillHtml = generateBillTemplate
        .replace('{{patient_name}}', patient_name)
        .replace('{{p_phno}}', p_phno)
        .replace('{{h_add}}', h_add)
        .replace('{{p_add}}', p_add)
        .replace('{{donor_id}}', donor_id)
        .replace('{{donor_name}}', donor_name)
        .replace('{{phone_no}}', phone_no)
        .replace('{{donor_address}}', donor_address)
        .replace('{{blood_type}}', blood_type)
        .replace('{{blood_bank_name}}', blood_bank_name);

    // Send the generated HTML as the response
    res.send(generateBillHtml);
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
