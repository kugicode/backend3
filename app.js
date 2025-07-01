// app.js - Full CRUD API with MongoDB Integration

// 1. Import necessary modules using ES Module syntax
import express from 'express';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'; // Correctly imported ObjectId
import 'dotenv/config'; // Correctly imports dotenv to load .env file
import bcrypt from 'bcryptjs';

// 2. MongoDB Connection Configuration (using process.env for URI)
//    Make sure your .env file has: MONGO_URI=mongodb://localhost:27017/your_database_name
const connectionURI = process.env.MONGO_URI || "mongodb://localhost:27017/default_api_db"; // Use env variable, with a fallback

const client = new MongoClient(connectionURI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true, // Recommended: enforce strict mode for queries
        deprecationErrors: true
    }
});

// 3. Declare global variables to hold database and collection references
//    These will be assigned once connectToDatabase runs successfully
let database;
let itemsCollection; // Renamed from testCollection for clarity and consistency with 'items' routes
let usersCollection;


// 4. MongoDB Connection Function
async function connectToDatabase() {
    try {
        await client.connect(); // Attempt to connect to the MongoDB server
        console.log('Connected to MongoDB! 💾');

        // Assign the database object to the global 'database' variable
        database = client.db("BustersDB"); // Using a consistent database name, e.g., "BustersDB"
                                          // Make sure this matches your MONGO_URI in .env if you specify it there
                                          // Or, if your MONGO_URI doesn't specify a DB, this will create "BustersDB"

        // Get a reference to the 'items' collection and assign it globally
        itemsCollection = database.collection("items"); // Ensure collection name is consistent
        usersCollection = database.collection("users");
        console.log('"items" collection reference obtained.');

    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        // Exit the process if database connection fails, as the app can't function without it
        process.exit(1);
    }
}

// 5. Initialize Express app and port
const app = express();
const PORT = 3000;

// 6. Middleware to parse JSON data from incoming requests
app.use(express.json());

// --- REMOVED: In-memory 'items' array and 'id' counter ---
// We are now using itemsCollection from MongoDB instead!


// --- API Endpoints ---

// GET /first: Basic connection test
app.get('/first', (req, res) => {
    res.send('You\'ve successfully connected!');
});

// GET /second: Another basic test
app.get('/second', (req, res) => {
    res.send("This is the other API!");
});

// GET /items: Retrieve all items from MongoDB
// Route handler is 'async' because database operations are asynchronous
app.get('/items', async (req, res) => {
    console.log('GET /items request received.');
    try {
        // Find all documents in the 'items' collection and convert to an array
        const allItems = await itemsCollection.find({}).toArray();
        res.status(200).json(allItems);
    } catch (error) {
        console.error('Error fetching all items from DB:', error);
        // Use 500 Internal Server Error for general database/server errors
        res.status(500).json({ message: "Failed to retrieve items due to server error." });
    }
});

// POST /items: Add a new item to MongoDB
// Route handler is 'async' because database operations are asynchronous
app.post('/items', async (req, res) => {
    console.log('POST /items request received. Body:', req.body);

    const newItem = {
        name: req.body.name,
        price: req.body.price,
        // MongoDB automatically adds an '_id' field when you insert,
        // so we don't need a custom 'id' or 'nextId' here.
    };

    // Basic validation
    if (!newItem.name || typeof newItem.price !== 'number' || newItem.price <= 0) {
        return res.status(400).json({ message: "Name (string) and positive Price (number) are required!" });
    }

    try {
        // Insert the new item into the 'items' collection
        const result = await itemsCollection.insertOne(newItem);
        console.log(`New item inserted with _id: ${result.insertedId}`);

        // Respond with the created item (MongoDB adds the _id)
        res.status(201).json({ ...newItem, _id: result.insertedId });
    } catch (error) {
        console.error('Error inserting item into DB:', error);
        res.status(500).json({ message: "Failed to create item." });
    }
});

// GET /items/:id - Retrieve a single item by ID from MongoDB
app.get('/items/:id', async (req, res) => {
    const requestedID = req.params.id; // ID from URL is a string

    // Validate if the ID string is a valid MongoDB ObjectId format
    if (!ObjectId.isValid(requestedID)) {
        // Use 400 Bad Request for invalid client input format
        return res.status(400).json({ message: "Invalid ID format. Must be a valid MongoDB ObjectId." });
    }

    try {
        // Find one document by its _id. new ObjectId() converts the string to MongoDB's ObjectId type.
        const foundItem = await itemsCollection.findOne({ _id: new ObjectId(requestedID) });

        if (foundItem) {
            res.status(200).json(foundItem); // Item found, send it back
        } else {
            res.status(404).json({ message: "Item not found!" }); // Item not found with that ID
        }
    } catch (error) {
        console.error('Error fetching single item from DB:', error);
        // Use 500 Internal Server Error for general database/server errors
        res.status(500).json({ message: "Failed to retrieve item due to server error." });
    }
});

// DELETE /items/:id - Delete an item by ID from MongoDB
app.delete('/items/:id', async (req, res) => {
    const requestedID = req.params.id; // ID from URL is a string

    // Validate if the ID string is a valid MongoDB ObjectId format
    // Removed the semicolon ';' after the if condition
    if (!ObjectId.isValid(requestedID)) {
        return res.status(400).json({ message: "Invalid ID format. Must be a valid MongoDB ObjectId." });
    }

    try {
        // Delete one document by its _id
        const result = await itemsCollection.deleteOne({ _id: new ObjectId(requestedID) });

        if (result.deletedCount === 1) { // Check if exactly one document was deleted
            res.status(200).json({ message: "Item has been deleted!" });
        } else { // If deletedCount is 0, no item was found with that ID
            res.status(404).json({ message: "Item not found!" });
        }
    } catch (error) {
        console.error('Error deleting item from DB:', error);
        res.status(500).json({ message: "Failed to delete item due to server error." });
    }
});

// PUT /items/:id - Update an existing item by ID in MongoDB
app.put('/items/:id', async (req, res) => {
    const requestedID = req.params.id; // ID from URL is a string

    // Validate if the ID string is a valid MongoDB ObjectId format
    // Removed the semicolon ';' after the if condition
    if (!ObjectId.isValid(requestedID)) {
        return res.status(400).json({ message: "Invalid ID format. Must be a valid MongoDB ObjectId." });
    }

    // Validate the request body for update data
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: "Request body cannot be empty for update." });
    }
    // Optional: More specific validation for name/price types if needed
    if (req.body.name && typeof req.body.name !== 'string') {
        return res.status(400).json({ message: "Name must be a string if provided." });
    }
    if (req.body.price && (typeof req.body.price !== 'number' || req.body.price <= 0)) {
        return res.status(400).json({ message: "Price must be a positive number if provided." });
    }


    let newData = { // Data to update
        name: req.body.name,
        price: req.body.price
    };

    try {
        // Update one document by its _id using the $set operator
        // Fix: new Object(requestedID) changed to new ObjectId(requestedID)
        const updateResult = await itemsCollection.updateOne(
            { _id: new ObjectId(requestedID) }, // Filter: Find the document by its MongoDB ObjectId
            { $set: newData }                     // Update operator: $set updates only the fields provided in newData
        );

        if (updateResult.matchedCount === 0) { // No item found with the given ID
            res.status(404).json({ message: "Item not found!" });
        } else if (updateResult.modifiedCount === 0) { // Item found, but no fields were actually changed
            res.status(200).json({ message: "Item found, but no changes applied (data was identical)." });
        } else { // Item found and modified
            res.status(200).json({ message: "Item updated successfully!", updatedId: requestedID });
        }
    } catch (error) {
        console.error('Error updating item in DB:', error);
        // Fix: res.status(200),json changed to res.status(500).json
        res.status(500).json({ message: "Failed to update item due to server error." });
    }
});

app.post('/register', async (req, res) => {
    console.log('POST /register request received. Body:', req.body);
    const {username, password} = req.body;

    if(!username || !password){
    return res.status(400).json({message: "Enter a username and password to register."});
    }
    if(password.length < 6){
        return res.status(400).json({message: "Password must be less than 6 characters"});
    }

    try{
        const user = await usersCollection.findOne({username: username})
        if(user){
            return res.status(409).json({message: "User already exists pls try another name!"});
        }

         // 3. Hash the password
        //    generate a salt (random string)
        const salt = await bcrypt.genSalt(10); // 10 is the 'salt rounds' - higher is more secure but slower
        //    hash the password with the salt
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            username: username,
            password: hashedPassword
        }

        const result = await usersCollection.insertOne(newUser);
        console.log(`User registered with _id: ${result.insertedId}`);

// 6. Respond with success
        //    NEVER send the hashedPassword back in the response!
        res.status(201).json({ message: "User registered successfully!", userId: result.insertedId });

    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ message: "Server error during registration." });
    }
});


// 7. Start the server ONLY AFTER successfully connecting to the database
//    Wrap app.listen in an async function and call connectToDatabase inside it.
async function startApplication() {
    await connectToDatabase(); // Wait for the database connection to complete

    app.listen(PORT, () => {
        console.log(`Server is listening at http://localhost:${PORT}`);
        console.log("Press Ctrl+C to stop the server!");
    });
}

// Call the async function to start the entire application
startApplication();