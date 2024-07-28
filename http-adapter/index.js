const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const {logger} = require('../logger');
const {filesAdapter} = require('../files-adapter');
const multer = require("multer");

/** @class */
class HttpAdapter {
    /**
     * Creates an instance of HttpAdapter.
     * @param {object} httpConfig - Configuration object.
     * @param {string} httpConfig.host - The host on which the HTTP server should listen.
     * @param {number} httpConfig.port - The port on which the HTTP server should listen.
     * @param {string} httpConfig.path - The path on which the HTTP server should listen.
     * @param {object} [filesAdapterConfig] - Configuration for a file adapter.
     */
    constructor(httpConfig, filesAdapterConfig) {
        this.httpConfig = httpConfig;
        this.filesAdapterConfig = filesAdapterConfig;
    }

    /**
     * Start the HTTP server and set up request handling.
     * @param {function} callback - The callback function to be invoked when a POST request is received.
     */
    run(callback) {
        const {host, port, cors: {allowedAllHosts, corsOptions}} = this.httpConfig;

        // cors
        if (allowedAllHosts) {
            app.use(cors());
        } else {
            app.use(cors(corsOptions));
        }

        // Настройка размеров тела запроса
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ limit: '10mb', extended: true }));

        // server starting
        app.listen(port, host, () => {
            logger.info(`App listening HTTP (${host}:${port})`);
        });

        try {
            app.use(bodyParser.json());
        } catch (error) {
            logger.error(error);
        }

        // standard requests
        app.post(this.httpConfig.path, async (req, res) => {
            try {
                res.send(await callback(req.body));
            } catch (error) {
                logger.error(error);
                res.status(500).send('Internal Server Error');
            }
        });

        // files processing
        if (this.filesAdapterConfig) {
            const {createPath, createBase64Path, getPath, destination} = this.filesAdapterConfig;

            // multipart
            const storage = multer.memoryStorage();
            const upload = multer({storage: storage});
            app.post(createPath, upload.single('image'), async (req, res) => {
                try {
                    res.send(await filesAdapter.multipartProcessing(req, res, callback));
                } catch (error) {
                    logger.error(error);
                    res.status(500).send('Internal Server Error');
                }
            });

            // base64
            app.post(createBase64Path, async (req, res) => {
                try {
                    res.send(await filesAdapter.base64Processing(req, res, callback));
                } catch (error) {
                    logger.error(error);
                    res.status(500).send('Internal Server Error');
                }
            });

            // get
            app.use(getPath, express.static(destination)); // or `${path.dirname(require.main.filename)}/uploads`
        }
    }
}

module.exports = {HttpAdapter};
