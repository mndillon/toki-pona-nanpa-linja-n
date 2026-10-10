const path = require('path');
const base = __dirname;
const Constructor = require(path.join(base, 'campaign-constructor.js'));
global.TokiPonaCampaignConstructor = Constructor;
const { blueprint } = require(path.join(base, 'campaign-draft-v0.1.js'));
const Validator = require(path.join(base, 'campaign-validator.js'));

const campaign = Constructor.constructCampaign(blueprint);
const report = Validator.validateCampaign(campaign);
console.log(Validator.formatReport(report));
process.exitCode = report.ok ? 0 : 1;
