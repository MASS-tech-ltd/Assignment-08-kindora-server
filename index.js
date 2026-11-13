import express from "express";
import cors from "cors";
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

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
const joinEventCollection = db.collection('joinEvents');


app.get('/', (req, res) => {
    res.send({ message: 'Server is running here!!' })
})

app.get('/events', async (req, res) => {
    const result = await eventCollection.find().toArray();
    res.send(result);
})

app.get('/events/:id', async (req, res) => {
    const { id } = req.params;
    const result = await eventCollection.findOne({ _id: new ObjectId(id) })
    res.send(result);
})

app.get('/my-created-events/:email', async (req, res) => {
    const { email } = req.params;
    const result = await eventCollection.find({ email: email }).toArray()
    res.send(result);
})

app.get('/my-joined-events/:email', async (req, res) => {
    const { email } = req.params;
    const result = await joinEventCollection.find({ email: email }).toArray()
    res.send(result);
})

app.patch('/events/:id', async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    const result = await eventCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
    )
    res.json(result);
})

app.delete('/events/:id', async (req, res) => {
    const { id } = req.params;
    const result = await eventCollection.deleteOne({ _id: new ObjectId(id) })
    res.send(result);
})


app.post('/create-event', async (req, res) => {
    const data = req.body;
    const result = await eventCollection.insertOne(data);
    console.log(result);
    res.send(result);
})

app.post('/join-event', async (req, res) => {
    const data = req.body;
    const result = await joinEventCollection.insertOne(data);
    console.log(result);
    res.send(result);
})

app.listen(port, () => {
    console.log(`Server is running successfully at ${port}`)
})