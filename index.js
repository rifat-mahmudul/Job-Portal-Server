const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if(!token) return res.status(401).send({message : 'unAuthorized access'})
    if(token){
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
          return res.status(401).send({message : 'unAuthorized access'})
        }
        req.user = decoded;
        next();
      })
    }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zee3o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const roomsCollection = client.db('Stayzy').collection('rooms');
    const usersCollection = client.db('Stayzy').collection('users')

    //create token with jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn : '2h'})
      res
      .cookie('token', token, {
        httpOnly : true,
        secure : process.env.NODE_ENV === 'production',
        sameSite : process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
      .send({success : true})
    })

    app.get('/logout', (req, res) => {
      res
      .clearCookie('token', {
        httpOnly : true,
        secure : process.env.NODE_ENV === 'production',
        sameSite : process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge : 0,
      })
      .send({success : true})
    })

    //save and update user data in DB
    app.put('/user', async (req, res) => {
      const user = req.body;
      const options = {upsert : true};
      const query = {email : user?.email};

      const isExist = await usersCollection.findOne(query);

      if(isExist){
        if(user?.status === "Requested"){
          const result = await usersCollection.updateOne(query, {
            $set : {
              status : user?.status
            }
          })
          return res.send(result);
        }
        else{
          return res.send({message : "already saved in Database."})
        }
      }

      const updateDoc = {
        $set : {
          ...user,
          Timestamp : Date.now()
        }
      }

      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result);
    })

    //get all user data from DB
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    
    //get a user by email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = {email : email};
      const result = await usersCollection.findOne(query);
      res.send(result);
    })

  
    //post room on DB
    app.post('/room', async (req, res) => {
      const roomData = req.body;
      const result = await roomsCollection.insertOne(roomData);
      res.send(result);
    })

    //get rooms data form DB
    app.get('/rooms', async (req, res) => {
      const category = req.query.category;
      let query = {};
      if(category && category !== 'null') query = {category}
      const result = await roomsCollection.find(query).toArray();
      res.send(result)
    })

    //get single room Data from DB
    app.get('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await roomsCollection.findOne(query);
      res.send(result);
    })

    //get my-listings data for host by email
    app.get('/my-listings/:email', async (req, res) => {
      const email = req.params.email;
      const query = {'host.email' : email};
      const result = await roomsCollection.find(query).toArray();
      res.send(result)
    })

    //Delete my-list Data from DB
    app.delete('/my-listings/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await roomsCollection.deleteOne(query);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
