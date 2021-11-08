/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
const express = require('express');
const venom = require('venom-bot');
const http = require('http');
const { WebhookClient } = require('dialogflow-fulfillment');
const dialogflow = require('@google-cloud/dialogflow');
const app = express();
const portAPI = 8007;
const server = require('http').createServer(app);
const { body, validationResult } = require('express-validator');
const io = require('socket.io')(server, { cors: { origin: "*" } });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

app.get('/home', (req, res) => {
    res.render('home');
});

app.use(express.static(__dirname + '/images'));

server.listen(portAPI, () => {
    console.log('listening on port ' + portAPI);
});

io.on('connection', (socket) => {
    console.log('User connected:' + socket.id);

    socket.on('message', () => {
        venom
            .create({
                session: 'sessionName',
                catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
                    console.log(asciiQR); // Optional to log the QR in the terminal
                    var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
                        response = {};

                    if (matches.length !== 3) {
                        return new Error('Invalid input string');
                    }
                    response.type = matches[1];
                    response.data = new Buffer.from(matches[2], 'base64');

                    var imageBuffer = response;

                    require('fs').writeFile(
                        './images/out.png',
                        imageBuffer['data'],
                        'binary',
                        function (err) {
                            if (err != null) {
                                console.log(err);
                            }
                        }
                    );
                },

                logQR: false
            })
            .then((client) => {
                start(client);
            })
            .catch((error) => console.log(error));

        function start(client) {
            client.onStateChange((state) => {
                socket.emit('message', 'Status: ' + state);
                console.log('State changed: ', state);
                //socket.disconnect(true);
            });
        }
    });

    socket.on('ready', () => {
        setTimeout(function () {
            socket.emit('ready', './out.png');
        }, 2000);
    });
});

venom
    .create({ headless: true })
    .then((client) => start(client))
    .catch((erro) => {
        console.log(erro);
    });
//webhook dialogflow
app.post('/webhook', function (request, response) {
    const agent = new WebhookClient({ request, response });
    let intentMap = new Map();
    intentMap.set('nomedaintencao', nomedafuncao);
    agent.handleRequest(intentMap);
});
function nomedafuncao(agent) { }

const sessionClient = new dialogflow.SessionsClient({
    keyFilename: 'CHAVE-GOOGLE.json'
});

async function detectIntent(
    projectId,
    sessionId,
    query,
    contexts,
    languageCode
) {
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        sessionId
    );

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: query,
                languageCode: languageCode
            }
        }
    };

    if (contexts && contexts.length > 0) {
        request.queryParams = {
            contexts: contexts
        };
    }

    const responses = await sessionClient.detectIntent(request);
    return responses[0];
}

async function executeQueries(projectId, sessionId, queries, languageCode) {
    let context;
    let intentResponse;
    for (const query of queries) {
        try {
            console.log(`Pergunta: ${query}`);
            intentResponse = await detectIntent(
                projectId,
                sessionId,
                query,
                context,
                languageCode
            );
            console.log('Enviando Resposta');
            console.log(intentResponse.queryResult.fulfillmentText);
            return `${intentResponse.queryResult.fulfillmentText}`;
        } catch (error) {
            console.log(error);
        }
    }
}

function start(client) {
    client.onMessage(async (msg) => {
        if (msg.type === 'chat') {
            //integração de texto dialogflow
            let textoResposta = await executeQueries(
                'PROJECT-ID-GOOGLE',
                msg.from,
                [msg.body],
                'pt-BR'
            );
            client.sendText(
                msg.from,
                'Estou processando sua mensagem\n\n' +
                textoResposta.replace(/\\n/g, '\n')
            );
        }
    });

    app.post(
        '/send-message',
        [body('number').notEmpty(), body('message').notEmpty()],
        async (req, res) => {
            const errors = validationResult(req).formatWith(({ msg }) => {
                return msg;
            });

            if (!errors.isEmpty()) {
                return res.status(422).json({
                    status: false,
                    message: errors.mapped()
                });
            }

            const number = req.body.number;
            const message = req.body.message;

            //client.sendText(number, message);
            client
                .sendText(number, message)
                .then((response) => {
                    res.status(200).json({
                        status: true,
                        message: 'Mensagem enviada',
                        response: response
                    });
                })
                .catch((err) => {
                    res.status(500).json({
                        status: false,
                        message: 'Mensagem não enviada',
                        response: err.text
                    });
                });
            //res.send('Mensagem enviada');
        }
    );

    app.post(
        '/send-buttons',
        [
            body('number').notEmpty(),
            body('buttonTxt1').notEmpty(),
            body('buttonTxt2').notEmpty(),
            body('title').notEmpty(),
            body('desc').notEmpty()
        ],
        async (req, res) => {
            const errors = validationResult(req).formatWith(({ msg }) => {
                return msg;
            });

            if (!errors.isEmpty()) {
                return res.status(422).json({
                    status: false,
                    message: errors.mapped()
                });
            }

            const number = req.body.number;
            const buttonTxt1 = req.body.buttonTxt1;
            const buttonTxt2 = req.body.buttonTxt2;
            const title = req.body.title;
            const desc = req.body.desc;

            const buttons = [
                {
                    buttonText: {
                        displayText: buttonTxt1
                    }
                },
                {
                    buttonText: {
                        displayText: buttonTxt2
                    }
                }
            ];

            //client.sendText(number, message);
            client
                .sendButtons(number, title, buttons, desc)
                .then((response) => {
                    res.status(200).json({
                        status: true,
                        message: 'Mensagem enviada',
                        response: response
                    });
                })
                .catch((err) => {
                    res.status(500).json({
                        status: false,
                        message: 'Mensagem não enviada',
                        response: err.text
                    });
                });
            //res.send('Mensagem enviada');
        }
    );

    app.post(
        '/send-lists',
        [
            body('number').notEmpty(),
            body('Title').notEmpty(),
            body('subTitle').notEmpty(),
            body('Description').notEmpty(),
            body('menu').notEmpty(),
            body('op1').notEmpty(),
            body('t1').notEmpty(),
            body('d1').notEmpty(),
            body('op2').notEmpty(),
            body('t2').notEmpty(),
            body('d2').notEmpty(),
            body('t2b').notEmpty(),
            body('d2b').notEmpty()
        ],
        async (req, res) => {
            const errors = validationResult(req).formatWith(({ msg }) => {
                return msg;
            });

            if (!errors.isEmpty()) {
                return res.status(422).json({
                    status: false,
                    message: errors.mapped()
                });
            }

            const number = req.body.number;
            const Title = req.body.Title;
            const subTitle = req.body.subTitle;
            const Description = req.body.Description;
            const menu = req.body.menu;
            const op1 = req.body.op1;
            const t1 = req.body.t1;
            const d1 = req.body.d1;
            const op2 = req.body.op2;
            const t2 = req.body.t2;
            const d2 = req.body.d2;
            const t2b = req.body.t2b;
            const d2b = req.body.d2b;

            const list = [
                {
                    title: op1,
                    rows: [
                        {
                            title: t1,
                            description: d1
                        }
                    ]
                },
                {
                    title: op2,
                    rows: [
                        {
                            title: t2,
                            description: d2
                        },
                        {
                            title: t2b,
                            description: d2b
                        }
                    ]
                }
            ];

            client
                .sendListMenu(number, Title, subTitle, Description, menu, list)
                .then((response) => {
                    res.status(200).json({
                        status: true,
                        message: 'Mensagem enviada',
                        response: response
                    });
                })
                .catch((err) => {
                    res.status(500).json({
                        status: false,
                        message: 'Mensagem não enviada',
                        response: err.text
                    });
                });
            //res.send('Mensagem enviada');
        }
    );
}