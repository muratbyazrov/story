const {utils} = require('../utils');
const {logger} = require('../logger');
const {Client} = require('pg');
const {exec} = require('child_process');
const {DbError} = require('../errors');

class DbAdapter {
    constructor(options) {
        this.config = options;
        this.client = new Client(this.config.db);
        this.connectPostgres();
        this.runMigrations();
        this.setDbSearchPath();
    }

    async connectPostgres() {
        await this.client.connect(err => {
            if (err) {
                throw new DbError(err.message);
            }
            console.log('SYSTEM [INFO]: Connected to postgres data base');
        });
    }

    async runMigrations() {
        await exec(`/bin/sh ${__dirname}/migration-runner.sh`, (error, stdout, stderr) => {
            if (stdout) {
                console.log('SYSTEM', stdout);
            }
            if (stderr) {
                console.log('SYSTEM [INFO]:', stderr);
            }
            if (error !== null) {
                console.log(`SYSTEM [ERROR]: exec error: ${error}`);
            }
        });
    }

    async setDbSearchPath() {
        await this.client.query(`SET SEARCH_PATH = '${this.config.db.schema}'`);
    }

    async execQuery({queryName, params, options = {}}) {
        const preparedQuery = this.getPreparedQuery(queryName, params);
        try {
            const result = await this.client.query(preparedQuery);
            return options.singularRow ? result.rows[0] : result.rows;
        } catch (err) {
            logger.error(err.message);
            throw new DbError(err.message);
        }
    }

    getPreparedQuery(query, params, unlock = true) {
        let text = query;
        if (unlock) {
            text = this.unlockParams(text, params);
        }

        const values = [];
        let paramNum = 0;
        text = text
            .replace(/\:(\w+)/g, (text, placeholder) => {
                if (utils.has(params, placeholder)) {
                    ++paramNum;
                    values.push(params[placeholder]);
                    return `$${paramNum}`;
                }

                return text;
            })
            .trim();

        return {text, values};
    }

    unlockParams(query, params) {
        let unlockedTemplate = query;

        for (const param in params) {
            if (utils.has(params, param)) {
                unlockedTemplate = this.unlockTemplate(unlockedTemplate, param);
            }
        }

        return unlockedTemplate;
    }

    unlockTemplate(query, templateName) {
        const pattern = new RegExp(`/\\*${templateName}:(.+?)\\*/`, 'gm');
        return query.replace(pattern, '$1');
    }
}


module.exports = {DbAdapter};
