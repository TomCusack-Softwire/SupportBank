// Potential TODO: CSV stores currency as floats. Change implementation to use integers, so we don't lose the precision!
// TODO: move away from Moment (depreciated, not required for bootcamp!)

const moment = require("moment");
const readline = require("readline-sync");
const fs = require("fs");
const log4js = require("log4js");
const fast_xml_parser = require("fast-xml-parser");

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

let accounts = {}; // name: Account(name, amount, transactions)     => can find people by name easily
let all_transactions = [];

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
    }
}

function make_account(name) {
    if (!(name in accounts)) {
        accounts[name] = new Account(name);
    }
    return accounts[name];
}

function do_transaction(date_string, from_string, to_string, amount_string, narrative, line_counter=-1) {
    let from = make_account(from_string);
    let to = make_account(to_string);
    let amount = parseFloat(amount_string);

    let line_message = "";
    if (line_counter > 0) {
        line_message = " (line " + line_counter + ")";
    }

    // Is the date valid?
    let date = moment(date_string, [moment.ISO_8601, "DD/MM/YYYY"]);

    if (date && date.isValid()) {
        date = date.format("YYYY-MM-DD");
    } else {
        // Log a problem and remove date
        let message = "Invalid date: " + date + line_message + ". Removing the date.";
        logger.error(message);
        console.log("Error in CSV file. " + message);
        date = "No date listed";
    }

    // Is the amount valid?
    if (isNaN(amount) || amount < 0) {
        let message = "Invalid amount: " + amount + line_message + ". Setting to 0.";
        logger.error(message);
        console.log("Error in CSV file. " + message);
        amount = 0;
    }

    // Process the transaction
    let transaction_object = new Transaction(date, from, to, amount, narrative);
    from.amount -= amount;
    to.amount += amount;
    from.transactions.push(transaction_object);
    to.transactions.push(transaction_object);
}

function parse_CSV(input_string) {
    let all_transactions = [];
    let data = input_string.split("\n");
    let values = ["Date", "From", "To", "Narrative", "Amount"];

    for (let line of data.slice(1)) {
        // Parse CSV line to single_transaction
        let single_transaction = {};
        for (let column = 0; column < values.length; column++) {
            single_transaction[values[column]] = line.split(",")[column];
        }
        single_transaction["Date"] = moment(single_transaction["Date"], [moment.ISO_8601, "DD-MM-YYYY"]).format("YYYY-MM-DD");
        all_transactions.push(single_transaction);
    }

    return all_transactions;
}

function parse_JSON(input_string) {
    // Note: Some inconsistent names. Regex: FromAccount => From; ToAccount => To. Also format datestring properly
    let data = input_string.replace(/(From|To)Account/g, "$1").replace(/T00:00:00/g, "");

    return JSON.parse(data);
}

function parse_XML(input_string) {
    let parser = new fast_xml_parser.XMLParser({
        "ignoreAttributes": false
    });
    let data = parser.parse(input_string)["TransactionList"]["SupportTransaction"];

    // format with right column names
    let result = [];
    for (let transaction of data) {
        let date = transaction["@_Date"];
        if (isNaN(parseInt(date, 10))) {
            date = moment(date, [moment.ISO_8601, "DD-MM-YYYY"]);
        } else {
            date = moment("1900-01-01", "YYYY-MM-DD").add(date, "days");
        }
        result.push({
            "Date": date.format("YYYY-MM-DD"),
            "From": transaction["Parties"]["From"],
            "To": transaction["Parties"]["To"],
            "Narrative": transaction["Description"],
            "Amount": transaction["Value"],
        });
    }

    return result;
}

function parse_file(filename, wipe=true) {
    // Assume wipe on import, to help with testing. change default value or specify bool if not wanted.
    if (wipe) {
        accounts = {};
        all_transactions = [];
    }

    let data;
    try {
        data = fs.readFileSync(filename, "utf-8").trim();
    } catch (error) {
        logger.error(error);
        console.log("There was an error trying to read file: " + filename);
        return;
    }

    // Convert file to array of objects ('all_transactions' global variable)
    if (filename.endsWith(".csv")) {
        logger.info("Parsing CSV.");
        all_transactions = all_transactions.concat(parse_CSV(data));
    } else if (filename.endsWith(".json")) {
        logger.info("Parsing JSON.");
        all_transactions = all_transactions.concat(parse_JSON(data));
    } else if (filename.endsWith(".xml")) {
        logger.info("Parsing XML.");
        all_transactions = all_transactions.concat(parse_XML(data));
    } else {
        logger.error("Unknown file type for file: " + filename);
        console.log("Unknown file type. Please use either CSV, JSON, XML.");
        return;
    }

    // Parse all_transactions to 'accounts' global variable
    for (let line_counter = 0; line_counter < all_transactions.length; line_counter++) {
        let line = all_transactions[line_counter];
        do_transaction(line["Date"], line["From"], line["To"], line["Amount"], line["Narrative"], line_counter + 2); // +2: 1 for header, 1 for one-indexing
    }
}

function export_file(filename) {
    let string_data;
    if (filename.endsWith(".json")) {
        string_data = JSON.stringify(all_transactions, (key, value) => {
            if (key === "Amount") {
                return parseFloat(value);
            } else if (key === "Date") {
                return value;
            }
            return value;
        }, 2);
        string_data = string_data.replace(/"(From|To)": /g, "\"$1Account\": ");

    } else if (filename.endsWith(".csv")) {
        string_data = "Date,From,To,Narrative,Amount\n";
        for (let line of all_transactions) {
            string_data += line["Date"] + "," + line["From"] + "," + line["To"] + "," + line["Narrative"] + "," + line["Amount"] + "\n";
        }

    } else if (filename.endsWith(".xml")) {
        // sort out structure so XMLBuilder can take it easily
        let structure = {"TransactionList": {"SupportTransaction": []}};
        for (let transaction of all_transactions) {
            structure["TransactionList"]["SupportTransaction"].push({
                "@_Date": transaction["Date"],
                "Description": transaction["Narrative"],
                "Value": transaction["Amount"],
                "Parties": {
                    "From": transaction["From"],
                    "To": transaction["To"],
                }
            });
        }

        let builder = new fast_xml_parser.XMLBuilder({
            "ignoreAttributes": false,
            "format": true
        });
        string_data = '<?xml version="1.0" encoding="utf-8"?>\n' + builder.build(structure);

    } else {
        logger.error("Unknown file type for file: " + filename);
        console.log("Unknown file type. Please use either CSV, JSON, XML.");
        return;
    }

    try {
        fs.writeFileSync(filename, string_data);
    } catch (error) {
        logger.error(error);
        console.log("There was an error writing to file: " + filename + " (is it open currently?)");
        // return;
    }
}

// Main program
console.log(`Commands:
    Import File <File Name>
    Export File <File Name>
    List <Account>
    List All
Submit a blank string (nothing) to exit.`);

let user_input = " ";
while (true) {
    user_input = readline.question(">> ");
    logger.info("User input: " + user_input);

    if (user_input === "") {
        console.log("Thank you for using SupportBank.");
        break;

    } else if (user_input === "List All") {
        if (Object.keys(accounts).length === 0) {
            console.log("Please import a file first.");
        } else {
            for (let account of accounts) {
                console.log(account.name + ": " + account.amount.toFixed(2));
            }
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

    } else if (user_input.startsWith("Import File ")) {
        parse_file(user_input.slice(12));

    } else if (user_input.startsWith("Export File ")) {
        export_file(user_input.slice(12));

    } else {
        console.log("Invalid command.");
    }
}

logger.info("Terminated program safely.");