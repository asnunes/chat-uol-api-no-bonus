import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient, ObjectId } from "mongodb"
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
const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.string().required()
})

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

        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
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

app.post("/messages", async (req, res) => {
    const { user } = req.headers

    const validation = messageSchema.validate({ ...req.body, from: user }, { abortEarly: false })
    if (validation.error) return res.status(422).send(validation.error.details.map(detail => detail.message))

    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) return res.sendStatus(422)

        const message = { ...req.body, from: user, time: dayjs().format("HH:mm:ss") }
        await db.collection("messages").insertOne(message)

        res.sendStatus(201)

    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/messages", async (req, res) => {
    const { user } = req.headers
    const { limit } = req.query
    const numberLimit = Number(limit)

    if (limit !== undefined && (numberLimit <= 0 || isNaN(numberLimit))) return res.sendStatus(422)

    try {
        const messages = await db
            .collection("messages")
            .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }, { type: "message" }] })
            .limit(numberLimit)
            .toArray()

        res.send(messages)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/status", async (req, res) => {
    const { user } = req.headers

    if (!user) return res.sendStatus(404)

    try {
        const result = await db
            .collection("participants")
            .updateOne({ name: user }, { $set: { lastStatus: Date.now() } })

        if (result.matchedCount === 0) return res.sendStatus(404)

        return res.sendStatus(200)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

// Remoção de usuários inativos
setInterval(async () => {
    const tenSecondsAgo = Date.now() - 10000

    const inactive = await db
        .collection("participants")
        .find({ lastStatus: { $lte: tenSecondsAgo } })
        .toArray()

    if (inactive.length > 0) {

    }

}, 15000)

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))