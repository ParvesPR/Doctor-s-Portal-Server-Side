const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// CONNECT TO MONGO DB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yg9f1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log('DB Connected');

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const doctorCollection = client.db('doctordb').collection('services');
        const bookingCollection = client.db('doctordb').collection('bookings');
        const userCollection = client.db('doctordb').collection('users');
        const addDoctorCollection = client.db('doctordb').collection('doctors');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }

        // GET ALL DATA
        app.get('/appointment', async (req, res) => {
            const query = {};
            const cursor = doctorCollection.find(query).project({ name: 1 });
            const result = await cursor.toArray();
            res.send(result)

        });
        // LOAD ALL USERS
        app.get('/user', verifyJwt, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // MAKE USER AN ADMIN
        app.put('/user/admin/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // FIND ADMIN USER ONLY
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        });

        // GET USERS
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })
            res.send({ result, token });
        })

        // GET AVAILABLE APPOINTMENT
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1:  get all services
            const services = await doctorCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });


            res.send(services);
        });

        // GET A SINGLE USER DATA
        app.get('/appointments', verifyJwt, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });

        // ADD A DOCTOR
        app.post('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await addDoctorCollection.insertOne(doctor);
            res.send(result);
        });
        // DELETE A DOCTOR
        app.delete('/doctor/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await addDoctorCollection.deleteOne(filter);
            res.send(result);
        })

        // LOAD ALL DOCTORS
        app.get('/doctor', verifyJwt, verifyAdmin, async (req, res) => {
            const doctors = await addDoctorCollection.find().toArray();
            res.send(doctors)
        })

        // RECEIVE BOOKING APPOINTMENT DATA & LIMIT APPOINTMENT
        app.post('/appointments', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        });
        /**
             * API Naming Convention
             * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
             * app.get('/booking/:id') // get a specific booking 
             * app.post('/booking') // add a new booking
             * app.patch('/booking/:id) //
             * app.put('/booking/:id) // upsert
             * app.delete('/booking/:id) //
            */
    }
    finally { }
};
run().catch(console.dir)



app.get('/', (req, res) => {
    res.send("Doctor's portal server running")
});

app.listen(port, () => {
    console.log('Listening to port', port)
})