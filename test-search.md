# Advanced Search Test Guide

## ✅ **Fixed Issues**
- ✅ Fixed `useDebounce` import error (now using `useDebounceValue`)
- ✅ Fixed auth import path (`@/app/(auth)/auth` instead of `@/lib/auth`)
- ✅ Fixed array key linter errors
- ✅ Fixed template literal issues

## 🧪 **How to Test the Advanced Search**

### 1. **Open the Application**
- Navigate to `http://localhost:3001` in your browser
- Make sure you're logged in

### 2. **Open Advanced Search**
- **Method 1**: Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) from anywhere
- **Method 2**: Click the search icon in the sidebar
- **Method 3**: Click the search icon in the chat header

### 3. **Test Basic Search**
- Type any search term (e.g., "test", "hello", "scorecard")
- Results should appear as you type
- Try searching for:
  - Chat titles
  - Message content
  - Document names

### 4. **Test Filters**
- **Date Range**: Click "Any time" dropdown and select different time periods
- **Content Types**: Toggle between Chats, Messages, and Documents
- **Personas**: If you have personas created, test filtering by them
- **Clear Filters**: Test the "Clear filters" button

### 5. **Test Navigation**
- Click on search results to navigate to them
- Chat results should open the chat
- Message results should open the specific chat
- Document results should redirect appropriately

### 6. **Test Keyboard Shortcuts**
- `⌘K`/`Ctrl+K` to open
- `Esc` to close
- Arrow keys to navigate (if implemented)
- `Enter` to select (if implemented)

## 🔍 **Expected Behavior**

### **Search Results Should Show**:
- Icon indicating content type (hash for chats, user for messages, file for documents)
- Title of the content
- Preview snippet with highlighted search terms
- Creation date
- Persona badge (if applicable)

### **Filters Should Work**:
- Date filtering should limit results to the selected time period
- Content type filtering should show only selected types
- Persona filtering should show only content from selected personas

### **Performance**:
- Search should be debounced (300ms delay)
- Results should load quickly
- No more than 50 results should be shown

## 🐛 **Troubleshooting**

### **If Search Doesn't Open**:
- Check browser console for JavaScript errors
- Verify keyboard shortcuts are working
- Try clicking the search icon instead

### **If No Results Appear**:
- Make sure you have chats, messages, or documents to search
- Try broader search terms
- Check if filters are too restrictive
- Look at browser network tab for API errors

### **If API Errors Occur**:
- Check that you're logged in
- Verify the API endpoints are responding
- Check server console for errors

## 📊 **Test Data Suggestions**

To properly test the search, make sure you have:
- At least a few chat conversations
- Some uploaded documents
- Different personas created
- Content from different time periods

## ✨ **Success Criteria**

The advanced search is working correctly if:
- ✅ Search opens with keyboard shortcut
- ✅ Results appear as you type
- ✅ Filters work correctly
- ✅ Navigation to results works
- ✅ No console errors
- ✅ Performance is smooth
- ✅ UI is responsive and looks good 