const express = require('express')
const {generateSlug} = require('random-word-slugs')
const {ECSClient, RunTaskCommand}= require('@aws-sdk/client-ecs')
const {Server} = require('socket.io')
const Redis = require('ioredis')

const app = express()
const PORT = 9000

const subscriber = new Redis({
    
});

const io=new Server({ cors: '*'})

io.on('connection',socket=> {
    socket.on('subscribe', channel => {
        socket.join(channel)
        socket.emit('message',`Joined ${channel}`)
    })
})

io.listen(9001, ()=>console.log('Socket Server 9001'))

const ecsClient = new ECSClient({
    region:'ap-south-1',
    credentials:{
        accessKeyId: 'AKIAQEFWAUKYROWISYEA',
        secretAccessKey:'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',
        tls : {},
    }
})

const config = {
    CLUSTER: 'arn:aws:ecs:ap-south-1:008971657905:cluster/builder-cluster',
    TASK: 'arn:aws:ecs:ap-south-1:008971657905:task-definition/builder-task'
}

app.use(express.json())

app.post('/project',async (req, res) => {
    const { gitURL } = req.body
    const projectSlug = generateSlug()
    //spin the container
    const command = new RunTaskCommand({
        cluster : config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-08e12e1a76734e4ce','subnet-0df63e1e5d419e7f6','subnet-0df98215f20d4e557'],
                securityGroups: ['sg-00c95d2e36b0836c8']

            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        {name: 'GIT_REPOSITORY__URL',value: gitURL},
                        {name: 'PROJECT_ID', value: projectSlug}
                    ]
                }
            ]
        }
    })
    await ecsClient.send(command);

    return res.json({ status: 'queued', data: {projectSlug, url: `http://${projectSlug}.localhost:8000`} })
})

async function initRedisSubscribe() {
    console.log('Subscribed to logs...')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage',(pattern, channel, message) =>{
        io.to(channel).emit('message',message)
    })
}

initRedisSubscribe()

app.listen(PORT, () => console.log(`API Server Running..${PORT}`))