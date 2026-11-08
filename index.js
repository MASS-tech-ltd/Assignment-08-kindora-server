import express from "express";
import cors from "cors";
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("kindora");
const eventCollection = db.collection('events');


app.get('/', (req, res) => {
    res.send({ message: 'Server is running here!!' })
})

app.post('/create-event', async (req, res) => {
    const data = req.body;
    const result = await eventCollection.insertOne(data);
    console.log(result);
    res.send(result);
})

app.listen(port, () => {
    console.log(`Server is running successfully at ${port}`)
})