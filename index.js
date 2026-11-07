import express from "express";
import cors from "cors";
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const app = express();
const port = process.env.PORT || 5000;


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

connectToMongoDB()


app.get('/', (req, res) => {
    res.send({ message: 'Server is running here!!' })
})

app.listen(port, () => {
    console.log(`Server is running successfully at ${port}`)
})