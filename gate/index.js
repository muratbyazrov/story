const {utils} = require('../utils');
const {validator} = require('../validator');
const {logger} = require('../logger');
const {systemResponse} = require('../system-response');
const {gateSchema} = require('./gate-schema.js');
const {ValidationError} = require('../system-errors/validation-error');

class Gate {
    constructor(controllers) {
        this.controllers = {};
        for (const {controller, domain} of controllers) {
            this.controllers[domain] = new controller();
        }
    }

    async run(request) {
        try {
            let data;
            if (utils.isObject(request)) {
                data = request;
            } else if (utils.isJson(request)) {
                data = JSON.parse(request);
            } else {
                throw new ValidationError('Request error. Maybe request is not JSON');
            }

            console.info(`SYSTEM [INFO]: Got request:`, data);
            validator.validate(data, gateSchema);
            const result = systemResponse.form(request, await this.controllers[data.domain].run(data));
            console.info(`SYSTEM [INFO]: Send result:`, result);
            return result;
        } catch (err) {
            const error = systemResponse.form(request, err);
            logger.log(error);
            return error;
        }
    }
}

module.exports = {Gate};
