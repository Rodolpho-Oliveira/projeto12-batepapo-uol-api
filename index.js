import express from "express"
import cors from "cors"
import dayjs from "dayjs"
import dotenv from "dotenv"
import joi from "joi"
import { MongoClient} from "mongodb"
dotenv.config()

const mongoClient = new MongoClient(process.env.MONGO_URI)
let dataBase = null
mongoClient.connect().then(() => {
	dataBase = mongoClient.db("batepapouol")
})

const participantsSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message","private_message").required()
})

const app = express()
app.use(express.json())
app.use(cors())

app.post("/participants", (req,res) =>{
    const validation = participantsSchema.validate(req.body)
    if(validation.error){
        res.status(422).send("Preencha corretamente!")
    }
    else{
        req.body.lastStatus = Date.now()
        dataBase.collection("participants").insertOne(req.body)
        const time = dayjs(req.body.lastStatus)
        if(time.$m < 10){
            time.$m = "0" + time.$m
        }
        if(time.$s < 10){
            time.$s = "0" + time.$s
        }
        if(time.$H < 10){
            time.$H = "0" + time.$H
        }
        dataBase.collection("message").insertOne({
            from: req.body.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: `${time.$H}:${time.$m}:${time.$s}`
        })
        res.sendStatus(201)
    }
})

app.get("/participants", (req,res) => {
   dataBase.collection("participants").find().toArray().then(users => {
       res.send(users)
   })
})

app.post("/messages", (req,res) => {
    req.body.from = req.headers.user
    const message = req.body
    dataBase.collection("messages").insertOne(message)
})

app.listen(5000)