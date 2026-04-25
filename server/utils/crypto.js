const crypto = require("crypto");

function hashPassword(password, saltHex){
  const salt = Buffer.from(saltHex, "hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256");
  return hash.toString("hex");
}

function makeSalt(){
  return crypto.randomBytes(16).toString("hex");
}

function makeToken(){
  return crypto.randomBytes(24).toString("hex");
}

function nowPlusDays(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

module.exports = {
  hashPassword,
  makeSalt,
  makeToken,
  nowPlusDays
};