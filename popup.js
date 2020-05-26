class AmazonPriceChecker {
    constructor() {
        this.itemsList = [];
        this.name = document.getElementById('item-name');
        this.currentPrice = document.getElementById('current-price');
        this.lowestPrice = document.getElementById('lowest-price');
        this.highestPrice = document.getElementById('highest-price');
        this.updatedOn = document.getElementById('updated-time');
        this.status = document.getElementById('status');
        this.url = null;
        this.index = 0;
        this.currentItem = null;
    }

    /*
    * Get saved data and populate dropdown
    */
    startup() {
        this._getSavedItems().then(function(response) {
            if (response) {
                this.renderItemByIndex(0);
                this.itemsList.forEach(item => {
                    this._addToDropDown(item);
                });

                this.itemsList.forEach(item => {
                    this.updateItem(item);
                });
            }
        }.bind(this));
    }

    /*
    * Render item onto UI by array index
    */
    renderItemByIndex(index) {
        if (this.itemsList.length <= 0) {
            var blankItem = {
                Name: "--",
                CurrentPrice: "N/A",
                LowestPrice: "N/A",
                HighestPrice: "N/A",
                Date: "--",
                Status: "N/A",
                Url: null
            };

            this.renderItem(blankItem);
            return;
        }
        
        if (index == null || index < 0) {
            index = 0;
        }

        this.renderItem(this.itemsList[index]);
    }

    /*
    * Render item onto UI
    *
    * Parameters:
    *   item - Item to be rendered 
    */
    renderItem(item) {
        if (item != null) {
            this.name.innerText = item.Name.trim().substring(0,46);
            this.currentPrice.innerText = item.CurrentPrice;
            this.lowestPrice.innerText = item.LowestPrice;
            this.highestPrice.innerText = item.HighestPrice;
            this.updatedOn.innerText = item.Date;
            this.status.innerText = item.Status;
            this.url = item.Url;
            this.index = this._getIndex(item);
            this.currentItem = item;
        }
    }

    /*
    * Add item specified in url input
    */
    addItem() {
        var rawAmazonUrl = document.getElementById('amazon-url').value;
        
        if (!rawAmazonUrl || !rawAmazonUrl.toLowerCase().includes('amazon.ca')) {
            return;
        }

        document.getElementById('amazon-url').value = '';

        var amazonUrl = this._formatAmazonUrl(rawAmazonUrl);

        if (amazonUrl != null) {
            var result = {
                Action: "AddItem",
                Url: amazonUrl
            };

            chrome.runtime.sendMessage(result, function(response) {
                this._addToList(response);
                this._addToDropDown(response);
                this.renderItem(response);
            }.bind(this));
        }   
    }

    /*
    * On dropdown selection change, render chosen item onto UI
    *
    * Parameters:
    *   aTag - Anchor tag corresponding to selected item 
    */
    dropdownSelectionChanged(aTag) {
        var index = this._getIndexById(aTag.id);

        if (index != null && index >= 0) {
            this.renderItemByIndex(index);
        }

    }

    /*
    * Update item currently displayed on UI
    */
    updateCurrentItem() {
        if (!this.currentItem.Id) {
            return;
        }

        var result = {
            Action: "UpdateItem",
            Item: this.currentItem
        };

        chrome.runtime.sendMessage(result, function(response) {
            this._updateList(response);
            this.renderItem(response);
        }.bind(this));
    }

    /*
    * Update item
    *
    * Parameters:
    *   item - Item to be updated 
    */
    updateItem(item) {
        var result = {
            Action: "UpdateItem",
            Item: item
        };

        chrome.runtime.sendMessage(result, function(response) {
            this._updateList(response);
            if (response.Id === this.currentItem.Id) {
                this.renderItem(response);
            }
        }.bind(this));
    }

    /*
    * Update UI edited item
    */
    updateEditedItem() {
        if (!this.currentItem.Id) {
            return;
        }

        var result = {
            Action: "UpdateEditedItem",
            Item: this.currentItem,
            Name: this.name.innerText
        };

        chrome.runtime.sendMessage(result, function(response) {
            this._updateList(response);
            this.renderItem(response);
            this._updateDropDown(response);
        }.bind(this));
    }

    /*
    * On initial 'edit' button click, render new menu bar and enable edit
    * On final 'done' button click, render inital menu bar and save changes
    */
    editItem() {
        var itemName = this.name;

        var dropdown = document.getElementsByClassName('dropdown')[0];
        var searchContainer = document.getElementsByClassName('search-container')[0];
        var addButton = document.getElementById('add-button');
        var editButton = document.getElementById('edit-button');
        var removeButton = document.getElementById('remove-button');

        if (itemName.contentEditable == "false" || itemName.contentEditable == false) {
            itemName.contentEditable = true;
            itemName.classList.add('edit');
            dropdown.classList.add('disabled');
            searchContainer.classList.add('disabled');
            addButton.classList.add('disabled');
            editButton.innerText = "Done";
            removeButton.classList.remove('disabled')
        }
        else {
            itemName.contentEditable = false;
            itemName.classList.remove('edit');
            dropdown.classList.remove('disabled');
            searchContainer.classList.remove('disabled');
            addButton.classList.remove('disabled');
            editButton.innerText = "Edit";
            removeButton.classList.add('disabled');

            this.updateEditedItem();
        }
    }

    /*
    * Remove current item
    */
    removeItem() {
        if (!this.currentItem.Id) {
            return;
        }
        
        var result = {
            Action: "RemoveItem",
            Item: this.currentItem
        };

        chrome.runtime.sendMessage(result, function(response) {
            if (response) {
                this.itemsList = response;
                this.renderItemByIndex(0);
                this._clearDropDown();

                this.itemsList.forEach(item => {
                    this._addToDropDown(item);
                });

                itemName.contentEditable = false;
                itemName.classList.remove('edit');
                dropdown.classList.remove('disabled');
                searchContainer.classList.remove('disabled');
                addButton.classList.remove('disabled');
                editButton.innerText = "Edit";
                removeButton.classList.add('disabled');
            }
        }.bind(this));
    }

    /*
    * On title click, open url on new tab
    */
    openUrl() {
        if (this.url == null) {
            return;
        }

        var itemName = this.name;
        if (itemName.contentEditable == "false" || itemName.contentEditable == false) {
            chrome.tabs.create({
                url: this.url
            });
        }
    }

    /*
    * Private Function: Shorten amazon url
    *
    * Parameters:
    *   url - raw amazon url 
    */
    _formatAmazonUrl(url) {
        if (url == null) {
            return null;
        }

        var indexStart = url.indexOf('/dp/');
        var indexEnd = indexStart + 14;
        var amazonUrl = "https://www.amazon.ca" + url.substring(indexStart, indexEnd);

        return amazonUrl;
    }

    /*
    * Private Function: Get all saved items
    */
    _getSavedItems() {
        return new Promise((resolve, reject) => {
            var result = {
                Action: "GetItems"
            };
    
            chrome.runtime.sendMessage(result, function(response) {
                this.itemsList = response;
                resolve(true);
            }.bind(this));
        });
    }

    /*
    * Private Function: Get array index for desired item
    *
    * Parameters:
    *   item - The item corresponding to required array index  
    */
    _getIndex(item) {
        return this.itemsList.findIndex(i => i.Id == item.Id);
    }

    /*
    * Private Function: Get array index for desired item by id
    *
    * Parameters:
    *   id - Id of desired item 
    */
    _getIndexById(id) {
        var item = {
            Id: id
        };

        return this._getIndex(item);
    }

    /*
    * Private Function: Add item to array list
    *
    * Parameters:
    *   item - Item to be added 
    */
    _addToList(item) {
        if (item != null) {
            this.itemsList.push(item);
        }
    }

    /*
    * Private Function: Add item to dropdown
    *
    * Parameters:
    *   item - Item to be added 
    */
    _addToDropDown(item) {
        var dropDown = document.getElementById('dropdown-list');
        var nextItemNumber = dropDown.getElementsByTagName('a').length + 1;

        var aTag = document.createElement('a');
        aTag.id = item.Id;

        var spanItemNumber = document.createElement('span');
        spanItemNumber.id = "item-" + item.Id;
        spanItemNumber.innerText = nextItemNumber + '. ';

        var spanItemName = document.createElement('span');
        spanItemName.id = "name-" + item.Id;
        spanItemName.innerText = item.Name.trim().substring(0,82);

        aTag.addEventListener("click", function() {
            this.dropdownSelectionChanged(aTag);
        }.bind(this));

        aTag.appendChild(spanItemNumber);
        aTag.appendChild(spanItemName);
        dropDown.appendChild(aTag);
    }

    /*
    * Private Function: Update existing item in array list with passed in item
    *
    * Parameters:
    *   item - Item to be updated 
    */
    _updateList(item) {
        var index = this._getIndexById(item.Id);

        if (this.itemsList[index].Id === item.Id) {
            this.itemsList[index] = item;
        }
    }

    /*
    * Private Function: Remove all items in dropdown
    */
    _clearDropDown() {
        var dropDown = document.getElementById('dropdown-list');

        while (dropDown.lastChild) {
            dropDown.removeChild(dropDown.lastChild);
        }
    }

    /*
    * Private Function: Update existing item in dropdown with passed in item
    *
    * Parameters:
    *   item - Item to be updated
    */
    _updateDropDown(item) {
        var spanId = "name-" + item.Id;
        var spanTag = document.getElementById(spanId);

        if (spanTag != null) {
            spanTag.innerText = item.Name;
        }
    }
}

/*
* Add all required listeners
* Gets executed when user opens extension
*/
document.addEventListener("DOMContentLoaded", function() {
    var amazonPriceChecker = new AmazonPriceChecker();
    amazonPriceChecker.startup();
    
    var addButton = document.getElementById('add-button');
    addButton.addEventListener("click", function(){
        amazonPriceChecker.addItem();
    });
    
    var editButton = document.getElementById('edit-button');
    editButton.addEventListener("click", function(){
        amazonPriceChecker.editItem();
    });

    var removeButton = document.getElementById('remove-button');
    removeButton.addEventListener("click", function(){
        amazonPriceChecker.removeItem();
    });

    var itemTitle = document.getElementById('item-name');
    itemTitle.addEventListener("click", function(){
        amazonPriceChecker.openUrl();
    });

    var refreshButton = document.getElementById('refresh-button');
    refreshButton.addEventListener("click", function(){
        amazonPriceChecker.updateCurrentItem();
    });
});