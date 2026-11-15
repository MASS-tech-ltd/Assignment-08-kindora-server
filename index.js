
import express from "express";
import cors from "cors";
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


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


// JWT Configuration
const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
);


// JWT Verification Middleware
const varifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({
            message: "Unauthorized! Token missing."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const { payload } = await jwtVerify(token, JWKS);

        // Verified user information
        req.user = payload;

        console.log("JWT Verified:", payload);

        next();

    } catch (error) {
        console.error("JWT Verification Error:", error);

        return res.status(401).send({
            message: "Invalid or expired token!",
            error: error.message,
        });
    }
};


// Unique Index: One user can join one event only once
// Partial index keeps old documents without eventId/userId unaffected.
await joinEventCollection.createIndex(
    { eventId: 1, userId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            eventId: { $type: "string" },
            userId: { $type: "string" }
        }
    }
);


// Home Route
app.get('/', (req, res) => {
    res.send({ message: 'Server is running here!!' });
});




// Get All Upcoming Events
app.get('/events', async (req, res) => {
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

    const result = await eventCollection
        .find({
            eventDate: { $gt: today }
        })
        .sort({ eventDate: 1 })
        .toArray();

    res.send(result);
});


// Get Home Upcoming Events
app.get('/home-events', async (req, res) => {
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

    const result = await eventCollection
        .find({
            eventDate: { $gt: today }
        })
        .sort({ _id: -1 })
        .limit(6)
        .toArray();

    res.send(result);
});



// Get Single Event
app.get('/events/:id', async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID!" });
    }

    const result = await eventCollection.findOne({
        _id: new ObjectId(id)
    });

    if (!result) {
        return res.status(404).send({ message: "Event not found!" });
    }

    res.send(result);
});


// Get Volunteer Count of an Event
app.get('/events/:id/volunteer-count', async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID!" });
    }

    const eventId = id;

    const count = await joinEventCollection.countDocuments({
        eventId: eventId
    });

    res.send({ volunteerCount: count });
});


// Check Whether Current User Already Joined
app.get('/events/:id/join-status', varifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID!" });
    }

    const userId = req.user.id || req.user.sub;

    if (!userId) {
        return res.status(401).send({ message: "User identity not found!" });
    }

    const joinedEvent = await joinEventCollection.findOne({
        eventId: id,
        userId: userId
    });

    res.send({
        joined: !!joinedEvent
    });
});


// Get My Created Events
app.get('/my-created-events/:email',
    varifyToken,
    async (req, res) => {

        const { email } = req.params;

        if (req.user.email !== email) {
            return res.status(403).send({
                message: "You are not allowed to access this data!"
            });
        }

        const result = await eventCollection
            .find({ email: req.user.email })
            .toArray();

        res.send(result);
    }
);


// Get My Joined Events
app.get('/my-joined-events/:email', varifyToken, async (req, res) => {

    const { email } = req.params;

    if (req.user.email !== email) {
        return res.status(403).send({
            message: "You are not allowed to access this data!"
        });
    }

    const result = await joinEventCollection
        .find({ email: req.user.email })
        .toArray();

    // Return event ID as _id for existing frontend EventDataTypes
    const joinedEvents = result.map(item => ({
        ...item,
        joinDocumentId: item._id,
        _id: item.eventId || item._id
    }));

    res.send(joinedEvents);
});


// Update Event
app.patch('/events/:id', varifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID!" });
    }

    const updatedData = req.body;

    const result = await eventCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
    );

    res.json(result);
});


// Delete Event
app.delete('/events/:id', varifyToken, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid event ID!" });
    }

    const result = await eventCollection.deleteOne({
        _id: new ObjectId(id)
    });

    res.send(result);
});


// Create Event
app.post('/create-event', varifyToken, async (req, res) => {
    const data = req.body;

    const result = await eventCollection.insertOne(data);

    console.log(result);

    res.send(result);
});


// Join Event
app.post('/join-event', varifyToken, async (req, res) => {

    try {
        const { eventId } = req.body;

        // Get authenticated user from JWT
        const userId = req.user.id || req.user.sub;
        const email = req.user.email;
        const name = req.user.name;

        if (!userId || !email) {
            return res.status(401).send({
                message: "User information not found in token!"
            });
        }

        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).send({
                message: "Valid event ID is required!"
            });
        }

        // Check whether event exists
        const event = await eventCollection.findOne({
            _id: new ObjectId(eventId)
        });

        if (!event) {
            return res.status(404).send({
                message: "Event not found!"
            });
        }

        // Check duplicate join
        const alreadyJoined = await joinEventCollection.findOne({
            eventId: eventId,
            userId: userId
        });

        if (alreadyJoined) {
            return res.status(409).send({
                message: "You have already joined this event!",
                joined: true
            });
        }

        // Keep event details, but use authenticated user identity
        const { _id, ...eventDetails } = event;

        const joinData = {
            ...eventDetails,
            eventId: eventId,
            userId: userId,
            id: userId,
            name: name,
            email: email,
            joinDate: new Date()
        };

        const result = await joinEventCollection.insertOne(joinData);

        console.log("Join Event Response:", result);

        res.status(201).send({
            message: "You have successfully joined this event!",
            joined: true,
            eventId: eventId,
            volunteerCount: await joinEventCollection.countDocuments({
                eventId: eventId
            })
        });

    } catch (error) {

        // Handles simultaneous duplicate requests
        if (error.code === 11000) {
            return res.status(409).send({
                message: "You have already joined this event!",
                joined: true
            });
        }

        console.error("Join Event Error:", error);

        res.status(500).send({
            message: "Failed to join event!"
        });
    }
});


app.listen(port, () => {
    console.log(`Server is running successfully at ${port}`);
});
