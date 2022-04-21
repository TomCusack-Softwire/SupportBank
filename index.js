// Potential TODO: CSV stores currency as floats. Change implementation to use integers, so we don't lose the precision!
const moment = require("moment");
const readline = require("readline-sync");
const fs = require("fs");
const log4js = require("log4js");

log4js.configure({
    appenders: {
        file: {type: 'fileSync', filename: 'debug.log'}
    },
    categories: {
        default: {appenders: ['file'], level: 'debug'}
    }
});

const logger = log4js.getLogger("SupportBank");
logger.info("Started program.");

let accounts; // name: Account(name, amount, transactions)     => can find people by name easily
let transactions;

class Account {
    constructor(name) {
        this.name = name;
        this.amount = 0;
        this.transactions = [];
    }
}

class Transaction {
    constructor(date, from, to, amount, narrative) {
        this.date = date;
        this.from = from.name;
        this.to = to.name;
        this.amount = amount;
        this.narrative = narrative;

        // do the transaction
        from.amount -= amount;
        to.amount += amount;

        // update the Accounts with this transaction
        from.transactions.push(this);
        to.transactions.push(this);
    }
}

function make_account(name) {
    if (!(name in accounts)) {
        accounts[name] = new Account(name);
    }
    return accounts[name];
}

function parse_CSV(filename) {
    // Given a CSV file, sets up 'accounts' and 'transactions' global variables
    accounts = {};
    transactions = [];

    let data = fs.readFileSync(filename, "utf-8").trim().split("\n");
    let values = data[0].split(",");

    for (let line_counter = 1; line_counter < data.length; line_counter++) {
        let line = data[line_counter];
        
        // Parse CSV to transaction
        let transaction = {};
        for (let row_counter = 0; row_counter < values.length; row_counter++) {
            transaction[values[row_counter]] = line.split(",")[row_counter];
        }

        // Parse transaction to Accounts / Transactions global variables
        let date = moment(transaction["Date"], "DD-MM-YYYY");
        let from = make_account(transaction["From"]);
        let to = make_account(transaction["To"]);
        let amount = parseFloat(transaction["Amount"]);
        let narrative = transaction["Narrative"];

        // Test for validity (log if not)

        if (!date.isValid()) {
            let message = "Invalid date: " + date + " (line " + (line_counter + 1) + "). Removing the date.";
            logger.error(message);
            console.log("Error in CSV file. " + message);
            date = "No date listed.";
        } else {
            date = date.format("YYYY-MM-DD");
        }

        if (isNaN(amount) || amount < 0) {
            let message = "Invalid amount: " + amount + " (line " + (line_counter + 1) + "). Setting to 0.";
            logger.error(message);
            console.log("Error in CSV file. " + message);
            amount = 0;
        }

        transactions.push(new Transaction(date, from, to, amount, narrative));

    }
}

// Main program
logger.info("Started parsing CSV.");
parse_CSV("DodgyTransactions2015.csv");
logger.info("Finished parsing CSV.");

let user_input = " ";
console.log("Usage: 'List <Account>' or 'List All' or enter a blank string to exit.");
while (true) {
    user_input = readline.question(">> ");

    if (user_input === "") {
        console.log("Thank you for using SupportBank.");
        break;

    } else if (user_input === "List All") {
        for (let name in accounts) {
            console.log(name + ": " + accounts[name].amount.toFixed(2));
        }

    } else if (user_input.startsWith("List ")) {
        let name = user_input.slice(5);
        if (name in accounts) {
            for (let transaction of accounts[name].transactions) {
                let message = "";
                if (name === transaction.from) {
                    message = "--> " + transaction.to;
                } else {
                    message = "<-- " + transaction.from;
                }
                console.log(message + ": " + transaction.amount.toFixed(2) + " for '" + transaction.narrative + "' (" + transaction.date + ") ");
            }
        } else {
            console.log("Not a valid user!");
        }

    } else {
        console.log("Invalid command.");
    }
}

logger.info("Terminated program safely.");