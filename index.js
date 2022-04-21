// Potential TODO: CSV stores currency as floats. Change implementation to use integers, so we don't lose the precision!
const moment = require("moment");
const readline = require("readline-sync");
const fs = require("fs");

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

    let data = fs.readFileSync(filename, "utf-8").trim();

    let values = data.split("\n", 1)[0].split(",");
    for (let line of data.split("\n").slice(1)) {
        // Parse CSV to transaction
        let transaction = {};
        for (let counter = 0; counter < values.length; counter++) {
            transaction[values[counter]] = line.split(",")[counter];
        }

        // Parse transaction to Accounts / Transactions variables
        let date = moment(transaction["Date"], "DD-MM-YYYY").format("YYYY-MM-DD");
        let from = make_account(transaction["From"]);
        let to = make_account(transaction["To"]);
        let amount = parseFloat(transaction["Amount"]);
        let narrative = transaction["Narrative"];

        transactions.push(new Transaction(date, from, to, amount, narrative));
    }
}

// Main program
parse_CSV("Transactions2014.csv");

let user_input = " ";
console.log("Usage: 'List <Account>' or 'List All' or enter a blank string to exit.");
while (true) {
    user_input = readline.question("> ");

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