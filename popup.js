// resources: chrome.tabs, chrome.storage

// TODO: add export functionality

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
    item.addClass('tabItem');
    item.data('meta', {'guid': guid, 'tab': tab});

    var header = item.find('#tabItemHeader');
    header.removeAttr('id');
    header.attr('href', tab['tabUrl']);
    header.text(tab['tabTitle']);
    header.click(function(event) {
        event.preventDefault();  // disable default link behavior
        chrome.tabs.create({'active': false, 'url': tab['tabUrl']});  // open in new tab
        event.stopPropagation();  // disable parent handling, e.g. checkbox selection
    });
    
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
    $('.tabular.menu > .customTab').tab();
    $('.accordion').accordion({ selector: {trigger: '.customDropdown'} });
    $('.checkbox').checkbox();

    // initialize event listeners
    // TODO: convert link into gmail-like checkbox
    $('#tabStore .customSelectAll').click(function() {
        if ($(this).text() == 'select all') {
            $(this).siblings('.tabItem').find('.checkbox').each(function() {
                $(this).checkbox('set checked');
            });
            $(this).text('unselect all');
        }
        else {
            $(this).siblings('.tabItem').find('.checkbox').each(function() {
                $(this).checkbox('set unchecked');
            });
            $(this).text('select all');
        }
    });

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

    // TODO: don't create existing tab?
    $('#open').click(function() {
        for (let tabMeta of getSelectedTabs()) {
            chrome.tabs.create({'active': false, 'url': tabMeta['tab']['tabUrl']});
        }
    });

    $('#openNewWindow').click(function() {
        var getTabUrl = function(tabMeta) { return tabMeta['tab']['tabUrl']; };
        var tabUrlsToOpen = getSelectedTabs().map(getTabUrl);
        chrome.windows.create({'focused': false, 'url': tabUrlsToOpen});
    });

    $('#bookmark').click(function() {
        var policyToNodeId = {
            'Bookmarks Bar': '1',
            'Other Bookmarks': '2'
        };
        chrome.bookmarks.getTree(function(bookmarkTree) {
            if (bookmarkTree.length > 0) {
                for (let treeNode of bookmarkTree[0].children) {
                    if (treeNode.id == policyToNodeId['Bookmarks Bar']) {
                        var found = false;
                        for (let bookmarkBarTreeNode of treeNode.children) {
                            if (bookmarkBarTreeNode.title == 'TabStore') {
                                addBookmarks(bookmarkBarTreeNode.id);
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            chrome.bookmarks.create({
                                'parentId': treeNode.id,
                                'title': 'TabStore'
                            }, function(extensionFolder) {
                                addBookmarks(extensionFolder.id);
                            });
                        }
                    }
                }
            }
        });
    });

    // TODO: add undo functionality
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

    $('.customTabCopy').click(function() {
        var tabItem = $(this).closest('.item');
        var $temp = $('<input>');
        $('body').append($temp);
        $temp.val(tabItem.find('.description').text());
        $temp.select();
        document.execCommand('copy');
        $temp.remove();
    });

    // TODO: add undo functionality
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

    // TODO: add undo functionality
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

function activateMenuTab(tabId) {
    $('.tabular.menu > .customTab.active').removeClass('active');
    $(tabId).addClass('active');
    $('#tabStore > .segment.active').removeClass('active');
    $(tabId + "Segment").addClass('active');
}

function addBookmarks(extensionFolderId) {
    for (let tabMeta of getSelectedTabs()) {
        chrome.bookmarks.create({
            'parentId': extensionFolderId,
            'title': tabMeta['tab']['tabTitle'],
            'url': tabMeta['tab']['tabUrl']
        });
    }
}

function getSelectedTabs() {
    var selectedTabs = [];
    var itemListId = $('#tabsTab').hasClass('active') ? '#tabList' : '#groupList';
    $(itemListId).find('.checkbox').each(function() {
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
        var guid = generateUUID();
        groupsMap['groups'][guid] = groupObject;
        chrome.storage.sync.set(groupsMap, function() {
            if (chrome.runtime.lastError) {
                console.log("Could not save tabs. Error: " + chrome.runtime.lastError);
            }
            else {
                var groupItem = renderGroup(guid, groupObject);
                groupItem.appendTo('#groupList');
                activateMenuTab('#groupsTab');
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
