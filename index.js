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
    type: joi.string().valid("message", "private_message").required(),
    from: joi.string().required()
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
    dataBase.collection("participants").findOne({
        name: req.body.name
    }).then(user => {
        if(user){
            res.sendStatus(409)
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
            dataBase.collection("messages").insertOne({
                from: req.body.name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: `${time.$H}:${time.$m}:${time.$s}`
            }).then(res.sendStatus(201))
        }
    })
    }
})

app.get("/participants", (req,res) => {
   dataBase.collection("participants").find().toArray().then(users => {
       res.send(users)
   })
})

app.post("/messages", (req,res) => {
    req.body.from = req.headers.user
    const validation = messageSchema.validate(req.body)
    if(validation.error){
        res.sendStatus(422)
    }
    else{
        const time = dayjs(new Date())
        if(time.$m < 10){
            time.$m = "0" + time.$m
        }
        if(time.$s < 10){
            time.$s = "0" + time.$s
        }
        if(time.$H < 10){
            time.$H = "0" + time.$H
        }
        req.body.time = `${time.$H}:${time.$m}:${time.$s}`
        dataBase.collection("messages").insertOne(req.body)
        res.sendStatus(201)
    }  
})

app.get("/messages", (req,res) => {
    const limit = req.query.limit
    const user = req.headers.user
    if(!limit){
        dataBase.collection("messages").find().toArray().then(message => {
            message.forEach(filterMessage => {
                if(filterMessage.to !== "Todos" && filterMessage.from !== user && filterMessage.to !== user){
                    message.splice(0, message.indexOf(filterMessage))
                }
            })
            res.send(message)
        })
    }
    else{
        dataBase.collection("messages").find().toArray().then(message => {
            if(message.length > 50){
                message.splice(0, (message.length - 50))
                message.forEach(filterMessage => {
                    if(filterMessage.to !== "Todos" && filterMessage.from !== user && filterMessage.to !== user){
                        message.splice(message.indexOf(filterMessage), 1)
                    }
                })
                res.send(message)
            }
        })
    }
})


app.post("/status", (req,res) => {
    const name = req.headers.user
    let validation = false
    dataBase.collection("participants").find().toArray().then(users => { 
        users.forEach(user => {
            if(user.name === name){
                dataBase.collection("participants").updateOne({
                    _id: user._id},
                    {$set: {
                        lastStatus: Math.round(new Date().getTime())
                }}).then(validation = true)
            }
        })
        if(validation){
            res.sendStatus(200)
            validation = false
        }
        else{
            res.sendStatus(404)
        }
    })
})

function status(){
    dataBase.collection("participants").find().toArray().then(users =>{
        users.forEach(user =>{
            if(Math.round(user.lastStatus/1000 + 10) < Math.round(new Date().getTime()/1000.0) ){
                dataBase.collection("participants").deleteOne(user)
                const time = dayjs(user.lastStatus)
                if(time.$m < 10){
                    time.$m = "0" + time.$m
                }
                if(time.$s < 10){
                    time.$s = "0" + time.$s
                }
                if(time.$H < 10){
                    time.$H = "0" + time.$H
                }
                dataBase.collection("messages").insertOne({
                    from: user.name,
                    to: "Todos",
                    text: "sai da sala...",
                    type: "status",
                    time: `${time.$H}:${time.$m}:${time.$s}`
                })
            }
        })
    })
}

setInterval(status, 15000)

app.listen(5000)