// resources: chrome.tabs, chrome.storage

// retrieve app data
chrome.storage.sync.get({'tabs': {}}, function(tabsMap) {
    for (var guid in tabsMap['tabs']) {
        var tabItem = renderTab(guid, tabsMap['tabs'][guid]);
        tabItem.appendTo('#tabList');
    }
    chrome.storage.sync.get({'groups': {}}, function(groupsMap) {
        for (var guid in groupsMap['groups']) {
            var groupItem = renderGroup(guid, groupsMap['groups'][guid]);
            groupItem.appendTo('#groupList');
        }

        initialize();
    });
});

function renderTab(guid, tab) {
    var item = $('#tabItemTemplate').clone(true);
    item.removeAttr('id');
    item.removeAttr('style');
    item.data('meta', {'guid': guid, 'tab': tab});

    var header = item.find('#tabItemHeader');
    header.removeAttr('id');
    header.attr('href', tab['tabUrl']);
    header.text(tab['tabTitle']);
    
    var description = item.find('#tabItemDescription');
    description.removeAttr('id');
    description.text(tab['tabUrl']);

    return item;
}

function renderGroup(guid, group) {
    var item = $('#groupItemTemplate').clone(true);
    item.removeAttr('id');
    item.removeAttr('style');
    item.data('meta', {'guid': guid, 'group': group});
    item.appendTo('#groupList');

    var header = item.find('#groupItemHeader');
    header.removeAttr('id');
    header.text(group['groupName']);
    
    var groupTabList = item.find('#groupTabList');
    groupTabList.removeAttr('id');
    
    for (var tabGuid in group['tabs']) {
        var tabItem = renderTab(tabGuid, group['tabs'][tabGuid]);
        tabItem.appendTo(groupTabList);
    }
    return item;
}

function initialize() {
    // initialize semantic ui
    $('.dropdown').dropdown();
    $('.tabular.menu > .customTab.item').tab();
    $('.accordion').accordion({ selector: {trigger: '.customDropdown'} });
    $('.checkbox').checkbox();

    // initialize event listeners
    $('#save').click(function() {
        $('#tabStore').dimmer('show');
        var tabsToSave = getSelectedTabs();
        $('#saveForm').off('click', '#saveButton');
        $('#saveForm').on('click', '#saveButton', $.proxy(saveHandler, null, tabsToSave));
    });

    $('#saveOpenTabs').click(function() {
        $('#tabStore').dimmer('show');
        chrome.windows.getCurrent(function(currentWindow) {
            chrome.tabs.query({'windowId': currentWindow.id}, function(openTabs) {
                var tabsToSave = [];
                for (let tab of openTabs) {
                    tabsToSave.push({
                        'guid': generateUUID(),
                        'tab': {
                            'tabTitle': tab.title,
                            'tabUrl': tab.url
                        }
                    });
                }
                $('#saveForm').off('click', '#saveButton');
                $('#saveForm').on('click', '#saveButton', $.proxy(saveHandler, null, tabsToSave));
            });
        });
    });

    $('#open').click(function() {
        for (let tabMeta of getSelectedTabs()) {
            chrome.tabs.create({'url': tabMeta['tab']['tabUrl']});
        }
    });

    $('#openNewWindow').click(function() {
        var getTabUrl = function(tabMeta) { return tabMeta['tab']['tabUrl']; };
        var tabUrlsToOpen = getSelectedTabs().map(getTabUrl);
        chrome.windows.create({'url': tabUrlsToOpen});
    });

    $('#tabList .customTabDelete').click(function() {
        var tabItem = $(this).closest('.item');
        var guid = tabItem.data('meta')['guid'];
        chrome.storage.sync.get({'tabs': {}}, function(tabsMap) {
            delete tabsMap['tabs'][guid];
            chrome.storage.sync.set(tabsMap, function() {
                if (chrome.runtime.lastError) {
                    console.log("Could not save tabs. Error: " + chrome.runtime.lastError);
                }
            });
        });
        tabItem.remove();
    });

    $('#tabList .customTabCopy').click(function() {
        var tabItem = $(this).closest('.item');
        var $temp = $('<input>');
        $('body').append($temp);
        $temp.val(tabItem.find('.description').text());
        $temp.select();
        document.execCommand('copy');
        $temp.remove();
    });

    $('#groupList .customGroupDelete').click(function() {
        var groupItem = $(this).closest('.item');
        var guid = groupItem.data('meta')['guid'];
        chrome.storage.sync.get({'groups': {}}, function(groupsMap) {
            delete groupsMap['groups'][guid];
            chrome.storage.sync.set(groupsMap, function() {
                if (chrome.runtime.lastError) {
                    console.log("Could not save groups. Error: " + chrome.runtime.lastError);
                }
            });
        });
        groupItem.remove();
    });

    $('#groupList .customTabDelete').click(function() {
        var tabItem = $(this).closest('.item');
        var tabGuid = tabItem.data('meta')['guid'];
        var groupItem = tabItem.parent().closest('.item');
        var groupGuid = groupItem.data('meta')['guid'];
        chrome.storage.sync.get({'groups': {}}, function(groupsMap) {
            delete groupsMap['groups'][groupGuid]['tabs'][tabGuid];
            chrome.storage.sync.set(groupsMap, function() {
                if (chrome.runtime.lastError) {
                    console.log("Could not save groups. Error: " + chrome.runtime.lastError);
                }
            });
        });
        tabItem.remove();
    });
}

function getSelectedTabs() {
    var selectedTabs = [];
    $('#tabList').find('.checkbox').each(function() {
        if( $(this).checkbox('is checked') ) {
            var tabMeta = $(this).closest('.item').data('meta');
            selectedTabs.push(tabMeta);
        }
    });
    return selectedTabs;
}

function saveHandler() {
    var tabsToSave = arguments[0];
    var groupObject = {
        'groupName': $('#saveForm').find('#groupName').val(), 
        'tabs': {}
    };
    $('#tabStore').dimmer('hide');
    $('#saveForm').find('#groupName').val('');
    for (let tabMeta of tabsToSave) {
        groupObject['tabs'][tabMeta['guid']] = tabMeta['tab'];
    }
    chrome.storage.sync.get({'groups': {}}, function(groupsMap) {
        groupsMap['groups'][generateUUID()] = groupObject;
        chrome.storage.sync.set(groupsMap, function() {
            if (chrome.runtime.lastError) {
                console.log("Could not save tabs. Error: " + chrome.runtime.lastError);
            }
        });
    });
}

chrome.runtime.onMessage.addListener(function(tab) {
    // console.log('Storing tab...');
    
});

function generateUUID () { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
