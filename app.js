//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

const databaseUri = process.env.MONGODB_URI;
if (!databaseUri) {
  throw new Error("MONGODB_URI is required");
}

const itemsSchema = {
  name: String
};

const Item = mongoose.model("Item", itemsSchema);


const defaultItems = [
  {_id: "000000000000000000000001", name: "Welcome to your todolist!"},
  {_id: "000000000000000000000002", name: "Hit the + button to add a new item."},
  {_id: "000000000000000000000003", name: "<-- Hit this to delete an item."}
];

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);


app.get("/", function(req, res, next) {
  Item.find({}, function(err, foundItems) {
    if (err) return next(err);
    if (foundItems.length > 0) {
      return res.render("list", {listTitle: "Today", newListItems: foundItems});
    }
    const defaults = defaultItems.map(item => ({
      updateOne: {
        filter: {_id: item._id},
        update: {$setOnInsert: {name: item.name}},
        upsert: true
      }
    }));
    Item.bulkWrite(defaults, function(writeError) {
      if (writeError) return next(writeError);
      res.redirect("/");
    });
  });
});

app.get("/:customListName", function(req, res, next) {
  const customListName = _.capitalize(req.params.customListName);
  List.findOne({name: customListName}, function(err, foundList) {
    if (err) return next(err);
    if (foundList) {
      return res.render("list", {listTitle: foundList.name, newListItems: foundList.items});
    }
    const list = new List({name: customListName, items: defaultItems});
    list.save(function(saveError) {
      if (saveError) return next(saveError);
      res.redirect("/" + encodeURIComponent(customListName));
    });
  });
});

app.post("/", function(req, res, next) {
  const {newItem, list: listName} = req.body;
  if (typeof newItem !== "string" || typeof listName !== "string" || !listName) {
    return res.status(400).send("Item and list must be text");
  }
  if (listName === "Today") {
    return Item.create({name: newItem}, function(err) {
      if (err) return next(err);
      res.redirect("/");
    });
  }
  List.findOneAndUpdate({name: listName}, {$push: {items: {name: newItem}}}, function(err, foundList) {
    if (err) return next(err);
    if (!foundList) return res.sendStatus(404);
    res.redirect("/" + encodeURIComponent(listName));
  });
});

app.post("/delete", function(req, res, next) {
  const {checkbox: itemId, listName} = req.body;
  if (!mongoose.isObjectIdOrHexString(itemId) || typeof listName !== "string" || !listName) {
    return res.status(400).send("Invalid item or list");
  }
  if (listName === "Today") {
    return Item.findByIdAndDelete(itemId, function(err) {
      if (err) return next(err);
      res.redirect("/");
    });
  }
  List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: itemId}}}, function(err, foundList) {
    if (err) return next(err);
    if (!foundList) return res.sendStatus(404);
    res.redirect("/" + encodeURIComponent(listName));
  });
});

app.get("/about", function(req, res){
  res.render("about");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

mongoose.connect(databaseUri)
  .then(() => app.listen(port, () => console.log("Server started successfully")))
  .catch(err => {
    console.error("MongoDB connection failed", err.name);
    process.exitCode = 1;
  });
