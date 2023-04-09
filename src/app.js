import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import joi from "joi"
import dayjs from "dayjs"

// Configs
const app = express()
app.use(cors())
app.use(express.json())
dotenv.config()

// Conexão DB
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

// Schemas
const participantSchema = joi.object({ name: joi.string().required() })

// Endpoints
app.post("/participants", async (req, res) => {
    const { name } = req.body

    const validation = participantSchema.validate(req.body, { abortEarly: false })
    if (validation.error) return res.status(422).send(validation.error.details.map(detail => detail.message))

    try {
        const participant = await db.collection("participants").findOne({ name })
        if (participant) return res.sendStatus(409)

        const timestamp = Date.now()
        await db.collection("participants").insertOne({ name, lastStatus: timestamp })

        const message = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(timestamp).format("HH:mm:ss") }
        await db.collection("messages").insertOne(message)

        return res.sendStatus(201)
    } catch (err) {
        return res.status(500).send(err.message)
    }
})

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))