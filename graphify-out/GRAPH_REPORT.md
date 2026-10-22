# Graph Report - sidebar  (2026-10-22)

## Corpus Check
- 112 files · ~106,097 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 14, .toml 5, .mn 1)

## Summary
- 1142 nodes · 1828 edges · 83 communities (39 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Appbar Components & Controls
- Bookmarks Sidebar
- Sidebar State Management
- Sidebar Main UI Container
- Testing & Harness (C4)
- Sidebar Main UI Container
- Bookmarks Sidebar
- History Sidebar
- Sidebar Tree View
- Bookmarks Sidebar
- Bookmarks Sidebar
- Sidebar Permissions
- Bookmarks Sidebar
- Bookmarks Sidebar
- Open Tabs Panel
- Appbar Components & Controls
- Open Tabs Panel
- Bookmarks Sidebar
- Synced Tabs Panel
- Sidebar Permissions
- Sidebar Customization
- Browser Sidebar Controller
- Appbar Components & Controls
- Browser Sidebar Controller
- Testing & Harness (C24)
- Browser Sidebar Controller
- Sidebar Subsystem 26
- Appbar Components & Controls
- Browser Sidebar Controller
- Testing & Harness (C29)
- Sidebar Subsystem 30
- Testing & Harness (C31)
- Sidebar Subsystem 32
- Testing & Harness (C33)
- Testing & Harness (C34)
- Testing & Harness (C35)
- Browser Sidebar Controller
- Testing & Harness (C37)
- Testing & Harness (C38)
- Testing & Harness (C39)
- Appbar Components & Controls
- Browser Sidebar Controller
- Bookmarks Sidebar
- Bookmarks Sidebar
- Testing & Harness (C44)
- Testing & Harness (C45)
- Testing & Harness (C46)
- Testing & Harness (C47)
- Testing & Harness (C48)
- Sidebar State Management
- Bookmarks Sidebar
- Bookmarks Sidebar
- Testing & Harness (C52)
- Testing & Harness (C53)
- Testing & Harness (C54)
- Testing & Harness (C55)
- Testing & Harness (C57)
- Appbar Components & Controls
- Browser Sidebar Controller
- Bookmarks Sidebar
- Testing & Harness (C61)
- Testing & Harness (C63)
- Bookmarks Sidebar
- Testing & Harness (C65)
- Testing & Harness (C66)
- Testing & Harness (C67)
- Testing & Harness (C68)

## God Nodes (most connected - your core abstractions)
1. `SidebarBookmarks` - 51 edges
2. `SidebarState` - 44 edges
3. `SidebarMain` - 43 edges
4. `SidebarHistory` - 38 edges
5. `SidebarTreeView` - 34 edges
6. `SidebarBookmarkList` - 34 edges
7. `SidebarPage` - 32 edges
8. `SidebarOpenTabs` - 27 edges
9. `SidebarPermissions` - 26 edges
10. `AppbarTabManager` - 24 edges

## Surprising Connections (you probably didn't know these)
- `SidebarBookmarkList` --inherits--> `SidebarTabList`  [EXTRACTED]
  sidebar-bookmark-list.mjs → sidebar-tab-list.mjs
- `SidebarBookmarks` --inherits--> `SidebarPage`  [EXTRACTED]
  sidebar-bookmarks.mjs → sidebar-page.mjs
- `SidebarCustomize` --inherits--> `SidebarPage`  [EXTRACTED]
  sidebar-customize.mjs → sidebar-page.mjs
- `SidebarHistory` --inherits--> `SidebarPage`  [EXTRACTED]
  sidebar-history.mjs → sidebar-page.mjs
- `SidebarOpenTabs` --inherits--> `SidebarPage`  [EXTRACTED]
  sidebar-opentabs.mjs → sidebar-page.mjs

## Import Cycles
- None detected.

## Communities (83 total, 44 thin omitted)

### Community 0 - "Appbar Components & Controls"
Cohesion: 0.05
Nodes (16): lazy, bookmarkFolderLocalization, lazy, l10nMap, { XPCOMUtils }, lazy, lazy, lazy (+8 more)

### Community 4 - "Testing & Harness (C4)"
Cohesion: 0.08
Nodes (3): TestContextualPasswordManagerDisabled, TestLastUsedSidebarPanel, TestSidebarButtonRemoval

### Community 5 - "Sidebar Main UI Container"
Cohesion: 0.06
Nodes (8): { DeferredTask }, getExtensions(), getRevampSwitcherItems(), getTools(), requestMaxWidthUpdate(), toolsAndExtensions(), toolsNameMap, _updateLauncherAndPanelMaxWidths()

### Community 6 - "Bookmarks Sidebar"
Cohesion: 0.07
Nodes (12): HORIZONTAL_VISIBILITIES, lazy, SidebarManager, VERTICAL_VISIBILITIES, lazy, BookmarksSidebarTestUtils, findBookmarkItemByGuid(), openFolder() (+4 more)

### Community 9 - "Bookmarks Sidebar"
Cohesion: 0.08
Nodes (7): lazy, { DOMFullscreenTestUtils }, test_sidebar_hidden_on_popup(), CustomizableUIInternal, gAreas, showHistorySidebar(), SidebarTestUtils

### Community 11 - "Sidebar Permissions"
Cohesion: 0.11
Nodes (6): cancelAllTabNotifications(), getTabNotificationCount(), lazy, removeNotificationsForBrowser(), SidebarPermissions, { SidebarPermissionsUI }

### Community 12 - "Bookmarks Sidebar"
Cohesion: 0.08
Nodes (9): lazy, run_test_adopt_from_window(), { PlacesTestUtils }, findInTree(), { PlacesTestUtils }, testBookmarkTitleRendering(), { PlacesTestUtils }, lazy (+1 more)

### Community 13 - "Bookmarks Sidebar"
Cohesion: 0.09
Nodes (3): SidebarBookmarkRow, SidebarTabList, SidebarTabRow

### Community 17 - "Bookmarks Sidebar"
Cohesion: 0.10
Nodes (9): activateContextMenuItem(), extData, getBookmarkFolder(), getBookmarkList(), getBookmarkRow(), imageBuffer, MODIFIED_PREFS, openAndWaitForContextMenu() (+1 more)

### Community 21 - "Browser Sidebar Controller"
Cohesion: 0.18
Nodes (19): _canShow(), debouncedMouseEnter(), _fireFocusedEvent(), _fireShowEvent(), handleToolbarButtonClick(), hide(), _loadSidebarExtension(), _maybeAnimate() (+11 more)

### Community 22 - "Appbar Components & Controls"
Cohesion: 0.16
Nodes (7): initialSidebarVisibility, getActionButtonElement(), getExpectedVersionString(), lazy, test_synced_tabs_sidebar_toggle(), testIconClick(), testSidebarToggle()

### Community 23 - "Browser Sidebar Controller"
Cohesion: 0.19
Nodes (12): _beginLauncherCollapse(), _cancelLauncherCollapse(), _checkIsHoveredOverLauncher(), _collapseLauncher(), collapseOnEscape(), _enableLauncherDragging(), _finalizeLauncherCollapse(), getMouseTargetRect() (+4 more)

### Community 25 - "Browser Sidebar Controller"
Cohesion: 0.17
Nodes (14): _disableLauncherDragging(), _disablePinnedTabsDragging(), handleKeydown(), hideSwitcherPanel(), init(), _recordBrowserSize(), recordPositionSetting(), recordTabsLayoutSetting() (+6 more)

### Community 26 - "Sidebar Subsystem 26"
Cohesion: 0.24
Nodes (3): lazy, SidebarCollapsedWindows, SidebarCollapsedWindowsImpl

### Community 28 - "Browser Sidebar Controller"
Cohesion: 0.19
Nodes (12): getAdoptedStateFromWindow(), getUIState(), handleEvent(), _handleLauncherResize(), refreshLauncherCollapsedWidth(), setLauncherCollapsedWidth(), startDelayedLoad(), toggleExpandOnHover() (+4 more)

### Community 31 - "Testing & Harness (C31)"
Cohesion: 0.27
Nodes (10): accessibleOf(), accService, allRows(), areTreeItems(), attrOf(), hasRole(), isExpanded(), isTree() (+2 more)

### Community 33 - "Testing & Harness (C33)"
Cohesion: 0.29
Nodes (6): getLists(), getSelectedRows(), { PlacesTestUtils }, resetSelection(), rowAt(), waitForRenderedRows()

### Community 34 - "Testing & Harness (C34)"
Cohesion: 0.29
Nodes (6): dragLauncher(), dragPinnedTabs(), mouseMoveInChunksHorizontal(), synthesizeMouseMove(), mouseMoveInChunksVertical(), synthesizeMouseMove()

### Community 35 - "Testing & Harness (C35)"
Cohesion: 0.27
Nodes (7): assertBeneathContentArea(), ensureLauncherVisibleWithoutAnimating(), getDurationToken(), getGroupZIndex(), getToken(), pressShortcut(), toggleWithShortcut()

### Community 36 - "Browser Sidebar Controller"
Cohesion: 0.25
Nodes (9): addOrUpdateExtension(), createMenuItem(), generateSidebarsMap(), isAIWindow(), makeSidebar(), registerExtension(), registerPrefSidebar(), setExtensionAttributes() (+1 more)

### Community 37 - "Testing & Harness (C37)"
Cohesion: 0.22
Nodes (4): lazy, { PlacesTestUtils }, { PromptTestUtils }, SORT_BUTTONS

### Community 38 - "Testing & Harness (C38)"
Cohesion: 0.39
Nodes (8): assertLauncherIsResizable(), assertSplitterAtLauncherEdge(), assertSplitterIsHitTestable(), DENSITY_ATTRIBUTE, dragLauncherSplitter(), getLauncherDocking(), resetLauncherWidth(), withExpandOnHoverWindow()

### Community 39 - "Testing & Harness (C39)"
Cohesion: 0.31
Nodes (4): assertLauncherReservationExact(), getReservedLauncherWidth(), launcherReservationIsExact(), novaEnabled

### Community 40 - "Appbar Components & Controls"
Cohesion: 0.32
Nodes (3): hidePanel(), init(), toggleAppbarVisibility()

### Community 41 - "Browser Sidebar Controller"
Cohesion: 0.25
Nodes (7): _clearToolbarButtonBadge(), dismissSidebarBadge(), handleToolBadges(), observe(), _showToolbarButtonBadge(), toggleTabstrip(), toggleTool()

### Community 42 - "Bookmarks Sidebar"
Cohesion: 0.32
Nodes (5): bookmarkTreeContainsGuid(), getTestBookmarkRow(), getTestFolderEl(), { PlacesTestUtils }, showBookmarksSidebarWithTestFolder()

### Community 43 - "Bookmarks Sidebar"
Cohesion: 0.25
Nodes (5): cutItem, deleteItem, descendentCount(), editItem, { PlacesTestUtils }

### Community 44 - "Testing & Harness (C44)"
Cohesion: 0.29
Nodes (3): getPanelHeader(), getPanelSwitcher(), VIEW_TO_TAG

### Community 45 - "Testing & Harness (C45)"
Cohesion: 0.43
Nodes (6): getLauncherButton(), getPreview(), hidePreview(), hoverLauncherButton(), moveMouseTo(), showPreview()

### Community 46 - "Testing & Harness (C46)"
Cohesion: 0.25
Nodes (3): { NonPrivateTabs }, { SessionStoreTestUtils }, { TelemetryTestUtils }

### Community 47 - "Testing & Harness (C47)"
Cohesion: 0.29
Nodes (3): { AddonTestUtils }, extData2, { ExtensionCommon }

### Community 48 - "Testing & Harness (C48)"
Cohesion: 0.38
Nodes (3): mouseMoveInChunksVertical(), resetToolsHeight(), resizeTools()

### Community 49 - "Sidebar State Management"
Cohesion: 0.29
Nodes (6): mockController, mockElement, mockGlobal, mockLitElement, { SidebarState }, { sinon }

### Community 50 - "Bookmarks Sidebar"
Cohesion: 0.53
Nodes (5): accessibleOf(), accService, areTreeItems(), attrOf(), isExpanded()

### Community 53 - "Testing & Harness (C53)"
Cohesion: 0.67
Nodes (5): assertFocusRingNotClipped(), assertLauncherFocusRings(), clippingAncestors(), focusRingReach(), inflate()

### Community 54 - "Testing & Harness (C54)"
Cohesion: 0.60
Nodes (5): elementStr(), expectFocusAfterKey(), setupSplitterTest(), tabThroughSidebarToSplitter(), test_sidebarSplitterTabOrder()

### Community 57 - "Testing & Harness (C57)"
Cohesion: 0.60
Nodes (3): pickSwitcherMenuitem(), testSidebarMenuKeyToggle(), waitForSwitcherPopupShown()

### Community 58 - "Appbar Components & Controls"
Cohesion: 0.67
Nodes (3): ctl(), list, render()

### Community 59 - "Browser Sidebar Controller"
Cohesion: 0.50
Nodes (3): _enablePinnedTabsSplitterDragging(), updatePinnedTabsHeightAfterReflow(), updatePinnedTabsHeightOnResize()

## Knowledge Gaps
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SidebarTestUtils` connect `Bookmarks Sidebar` to `Testing & Harness (C48)`, `Bookmarks Sidebar`, `Bookmarks Sidebar`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Should `Appbar Components & Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.0547945205479452 - nodes in this community are weakly interconnected._
- **Why does `SidebarManager` connect `Bookmarks Sidebar` to `Browser Sidebar Controller`, `Browser Sidebar Controller`, `Browser Sidebar Controller`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Should `Bookmarks Sidebar` be split into smaller, more focused modules?**
  _Cohesion score 0.07058823529411765 - nodes in this community are weakly interconnected._
- **Why does `SidebarPage` connect `Appbar Components & Controls` to `Bookmarks Sidebar`, `History Sidebar`, `Open Tabs Panel`, `Synced Tabs Panel`, `Sidebar Customization`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Should `Sidebar State Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05656565656565657 - nodes in this community are weakly interconnected._
- **Should `Sidebar Main UI Container` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._