const amqp = require('amqplib/callback_api');
const {logger} = require("../logger");
const {RmqError} = require("../errors/rmq-error");

class RmqAdapter {
    constructor(config) {
        this.config = config;
        this.connection = null;
    }

    run(callback) {
        const {host = 'localhost', port = 5672, user, password} = this.config.connect;
        const opt = {credentials: amqp.credentials.plain(user, password)};
        amqp.connect(`amqp://${host}:${port}`, opt, (error, connection) => {
            if (error) {
                logger.error(error);
                throw new RmqError(error);
            }
            logger.info(`Connected to rmq (${host}:${port})`);
            this.connection = connection;
            this.consume(callback);
        });
    }

    consume(callback) {
        const {
            queue = 'story',
            queueDurable = false,
            noAck = true,
            prefetchCount = 1,
            xMessageTtl = 10 * 60 * 1000,
        } = this.config.consume;

        this.connection.createChannel((error, channel) => {
            if (error) {
                logger.error(error.message);
                throw new RmqError(error);
            }

            channel.assertQueue(queue, {
                durable: queueDurable,
                arguments: {
                    "x-message-ttl": xMessageTtl
                }
            });
            channel.prefetch(prefetchCount);

            try {
                channel.consume(queue, msg => {
                    const message = msg.content.toString();
                    logger.info(`Got rmq message ${message}`);
                    callback(message);
                    channel.ack(msg);
                }, {noAck});
            } catch (err) {
                logger.error(err.message);
            }

        });
    }

    async publish(msg, {routingKey = '', queue = 'story'}) {
        const {
            exchange = 'story',
            exchangeType = 'direct',
            persistent = true,
            exchangeDurable = false,
            bindQueuePattern,
        } = this.config.publish;

        if (!this.channel) {
            this.channel = await new Promise((resolve, reject) => {
                this.connection.createChannel((error, channel) => {
                    if (error) {
                        logger.error(error.message);
                        reject(new RmqError(error.message));
                    } else {
                        channel.bindQueue(queue, exchange, bindQueuePattern);
                        channel.assertExchange(exchange, exchangeType, {durable: exchangeDurable});
                        resolve(channel);
                    }
                });
            });
        }

        try {
            logger.info(`Send rmq message: ${msg}`);
            this.channel.publish(exchange, queue, Buffer.from(msg), {persistent});
        } catch (err) {
            logger.error(err.message);
            throw new RmqError(err.message);
        }
    }
}

module.exports = {
    RmqAdapter,
};
