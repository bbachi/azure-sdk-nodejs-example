const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express(),
      bodyParser = require("body-parser");
      port = process.env.PORT || 3080;


app.use(bodyParser.json());

const account = process.env.ACCOUNT_NAME || "";
const SAS = process.env.SAS || "";

console.log("Account:::::::" + account);
console.log("SAS:::::::::"+SAS);


app.listen(port, () => {
    console.log(`Server listening on the port::${port}`);
});