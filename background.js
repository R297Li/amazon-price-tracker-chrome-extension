var items = [];
var nextId = 0;

/*
* Get new item and add it to storage
*
* Return: Callback function containing new item
*/
function addItem(item, callBack) {

    _fetchItem(item.Url, function(response) {
        items.push(response);
        _saveItems(items);

        callBack(response);
    }.bind(this));
}

/*
* Remove item from storage
*
* Return: Callback function containing array of remaining items
*/
function removeItem(item, callBack) {

    getItems(function(response) {
        var index = response.findIndex(i => i.Id == item.Item.Id);
        response.splice(index, 1);

        items = response;
        _saveItems(items);

        callBack(items);

    }.bind(this));
}

/*
* Gets all items from storage
*
* Return: Callback function containing array of all items
*/
function getItems(callBack) {
    _getFromStorage("Items", function(response) {
        items = [];

        if (response.Items != null && response.Items.length > 0) {
            response.Items.forEach(function(item) {
                items.push(item);

                if (item.Id >= nextId) {
                    nextId = item.Id + 1;
                }
            });
        }

        callBack(items);
    });
}

/*
* Fetch and update desired item
*
* Return: Callback function containing updated item
*/
function updateItem(item, callBack) {

    _fetchItem(item.Item.Url, function(response) {
        var index = items.findIndex(i => i.Id == item.Item.Id);
        
        if (items[index].Id === item.Item.Id) {

            items[index].CurrentPrice = response.CurrentPrice;

            if (response.LowestPrice < items[index].LowestPrice) {
                items[index].LowestPrice = response.LowestPrice;
                var message = "Prices for: '" + response.Name + "' is low!";
                alert(message);
            }

            if (response.HighestPrice > items[index].HighestPrice) {
                items[index].HighestPrice = response.HighestPrice;
            }

            items[index].Status = response.Status;
            items[index].Date = response.Date;
            
            _saveItems(items);

            callBack(items[index]);
        }
    }.bind(this));
}

/*
* Fetch and update all items
*
* Return: Callback function containing array of all updated items
*/
function updateAllItems(callBack) {
    items.forEach(function(item) {
        updateItem(item, function(response) {
            // Don't need to do anything
        });
    });

    callBack(items);
}

/*
* Update and save UI edited item
*
* Return: Callback function containing edited item
*/
function updateEditedItem(item, callBack) {
    var index = items.findIndex(i => i.Id == item.Item.Id);

    if (items[index].Id === item.Item.Id) {
        items[index].Name = item.Name;

        _saveItems(items);

        callBack(items[index]);
    }
}


/*
* Private Function: Fetch item from url
*
* Return: Callback function containing item
*/
function _fetchItem(url, callBack) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", url, true);

    xmlHttp.addEventListener("load", function(response) {
        var parser = new DOMParser();
        var url;

        var htmlBody = parser.parseFromString(response.target.responseText,"text/html");
        var url = response.target.responseURL;

        if (htmlBody == null) {
            htmlBody = parser.parseFromString(response.currentTarget.responseText,"text/html");
            url = response.currentTarget.responseURL;
        }

        var price = null;
        var status = null;
        var priceElement = htmlBody.getElementById('priceblock_ourprice');
        var statusElement = htmlBody.getElementById('availability');

        if (priceElement != null) {
            price = "$" + parseFloat(priceElement.innerText.replace(/[^0-9.]/g, ''));
        } 
        else {
            price = "N/A"
        }

        if (statusElement != null) {
            if (statusElement.innerText.toLowerCase().includes('in stock')) {
                status = "In Stock";
            }
            else if (statusElement.innerText.toLowerCase().includes('unavailable')) {
                status = "Unavailable";
            }
            else if (statusElement.innerText.toLowerCase().includes('ship')) {
                status = "In Stock";
            }
            else {
                status = "N/A"
            }
        }
        else {
            status = "N/A"
        }

        var name = htmlBody.getElementById('productTitle').innerText.trim();
        var date = _getCurrentTime();
        var id = ++nextId;

        var result = {
            Name: name,
            CurrentPrice: price,
            LowestPrice: price,
            HighestPrice: price,
            Url: url,
            Date: date,
            Id: id,
            Status: status
        };

        callBack(result);
    }.bind(this));

    xmlHttp.send(null);
}

/*
* Private Function: Save list of items
*/
function _saveItems(items) {
    _saveToStorage("Items", items);
}

/*
* Private Function: Get current date and time
*
* Return: Concatenation of date and time
*/
function _getCurrentTime() {
    var today = new Date();

    var currentTime = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var currentDate = today.getDate() + '/' + (today.getMonth() + 1) + '/' + today.getFullYear();

    return (currentDate + ' ' + currentTime);
}

/*
* Private Function: Save item to storage with specified key
*/
function _saveToStorage(key, item) {
    chrome.storage.sync.clear();

    var result = {
        [key]: item
    };

    chrome.storage.sync.set(result, function() {
        console.log("Saved");
    });
}

/*
* Private Function: Get item from storage with specified key
*
* Return: Callback function containing desired item
*/
function _getFromStorage(key, callBack) {

    if (!key) {
        key = null;
    }

    chrome.storage.sync.get(key, function(response) {
        callBack(response);
    });
}

/*
* Listener for messages sent from frontend
*/
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch(request.Action) {
            case "AddItem":
                addItem(request, function(response) {
                    sendResponse(response);
                });
                break;
            case "GetItems":
                getItems(function(response) {
                    sendResponse(response);
                });
                break;
            case "RemoveItem":
                removeItem(request, function(response) {
                    sendResponse(response);
                });
                break;
            case "UpdateItem":
                updateItem(request, function(response) {
                    sendResponse(response);
                });
                break;
            case "UpdateEditedItem":
                updateEditedItem(request, function(response) {
                    sendResponse(response);
                });
                break;
        }

        return true;
    }
);

/*
* Add periodic alarm to update prices of all items
*/
chrome.alarms.create("UpdatePrices", {periodInMinutes: 60});

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name == "UpdatePrices") {
        updateAllItems(function(response) {
            console.log("Items updated from alarm");
        })
    }
})
