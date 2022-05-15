const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// CONNECT TO MONGO DB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yg9f1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log('DB Connected')

async function run() {
    try {
        await client.connect();
        const doctorCollection = client.db('doctordb').collection('services');
        const bookingCollection = client.db('doctordb').collection('bookings');

        // GET ALL DATA
        app.get('/appointment', async (req, res) => {
            const query = {};
            const cursor = doctorCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)

        });

        // RECEIVE BOOKING APPOINTMENT DATA
        app.post('/appointment', async (req, res) => {
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