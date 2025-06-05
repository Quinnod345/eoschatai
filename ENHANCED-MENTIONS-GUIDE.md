# Enhanced @ Mentions System Guide

The @ mentions system has been completely redesigned to be more intelligent, contextual, and powerful. This guide covers all the new features and capabilities.

## 🚀 Key Enhancements

### 1. **Intelligent Suggestions**
The system now provides smart, context-aware suggestions based on:
- Current conversation context
- Time of day (e.g., calendar mentions in the morning)
- Recent message history
- Selected persona
- User behavior patterns

### 2. **Dynamic Content Integration**
Mentions can now pull real-time data:
- `@event:quarterly-review` - References a specific calendar event
- `@doc:project-plan` - Links to a specific document
- `@user:john` - Mentions a specific team member
- `@meeting:2pm` - References today's 2pm meeting

### 3. **Enhanced Categories**

#### 📁 **Resources** (`@doc`, `@scorecard`, `@vto`, `@rocks`)
- Access documents, files, and knowledge base items
- Dynamic search through your content
- Preview snippets in suggestions
- Recently accessed items prioritized

#### 📅 **Calendar** (`@cal`, `@event`, `@free`, `@meeting`)
- View and reference calendar events
- Find available time slots
- Check for conflicts
- Schedule new events naturally

#### 👥 **People** (`@team`, `@user`, `@contact`)
- Mention team members
- Reference specific people with context
- See roles and recent interactions
- Group mentions for teams

#### ⚡ **AI Tools** (`@search`, `@analyze`, `@summarize`, `@create`)
- Trigger specific AI capabilities
- Chain tools for complex operations
- Get contextual analysis
- Generate content with context

#### 💻 **Commands** (`@help`, `@recent`, `@favorites`, `@settings`)
- Quick system actions
- View mention history
- Manage favorites
- Configure preferences

#### 📝 **Templates** (`@agenda`, `@report`, `@email`)
- Insert pre-built templates
- Customize with context
- Chain with other mentions

### 4. **Advanced Features**

#### **Contextual Filtering**
- Suggestions filtered by relevance
- Category-based filtering with Tab key
- Permission-aware suggestions
- Time-based relevance scoring

#### **Mention Chaining**
Combine multiple mentions for rich context:
```
"Schedule a @meeting with @user:sarah about @doc:q4-roadmap at the next @free slot"
```

#### **Natural Language Processing**
The AI understands context around mentions:
```
"Can you @analyze last month's @scorecard and @create a summary for @team:leadership?"
```

#### **Smart Shortcuts**
- `@cal` → Calendar
- `@doc` → Documents  
- `@free` → Find available time
- `@fav` → Favorites

### 5. **Keyboard Navigation**

| Action | Shortcut |
|--------|----------|
| Open mentions | `@` |
| Navigate | `↑` `↓` |
| Select | `Enter` |
| Switch categories | `Tab` |
| Close | `Esc` |

### 6. **Backend Integration**

The enhanced system now:
- Automatically activates relevant AI tools
- Provides rich context to the AI
- Doesn't require explicit tool calls
- Handles complex multi-mention queries

## 💡 Usage Examples

### Basic Usage
```
"What's on my @cal today?"
"Show me the latest @scorecard"
"Find @doc:project-plan"
```

### Advanced Usage
```
"@analyze my @cal patterns and suggest @free times for deep work"
"@create an @agenda for tomorrow's @event:team-standup"
"@search all @doc related to @user:john's @rocks"
```

### Power User Tips

1. **Use shortcuts**: Type `@cal` instead of `@calendar`
2. **Chain mentions**: Combine multiple mentions for context
3. **Dynamic references**: Use `:` for specific items (`@doc:budget-2024`)
4. **Quick commands**: `@recent` shows your mention history
5. **Favorites**: Star frequently used mentions for quick access

## 🔧 Technical Implementation

### Architecture
- **MentionService**: Central service for suggestion logic
- **MentionProcessor**: Handles backend mention processing
- **Enhanced UI**: Rich dropdown with categories and previews
- **Smart Caching**: Recent mentions cached for performance

### Data Flow
1. User types `@` → Mention dropdown appears
2. Context analyzed → Intelligent suggestions generated
3. User selects mention → Added to message
4. Message sent → Backend processes mentions
5. AI tools activated → Enhanced response generated

### Extensibility
The system is designed to be easily extended:
- Add new mention types in `types.ts`
- Register handlers in `MentionService`
- Update UI components as needed
- Backend automatically processes new types

## 🎯 Benefits

- **Faster workflows**: No need to manually search for content
- **Better context**: AI understands exactly what you're referencing
- **Natural interaction**: Mention resources like you would in conversation
- **Powerful automation**: Complex operations with simple mentions
- **Learning system**: Improves suggestions based on usage

## 🚦 Migration Notes

The new system is backward compatible:
- Old format: `@calendar` still works
- New format: `@cal`, `@event:meeting-name` provides more power
- Existing mentions in chat history display correctly
- No action needed for existing users

## 🔮 Future Enhancements

Planned features include:
- Voice-activated mentions
- Cross-workspace mentions
- Custom mention types
- AI-suggested mentions
- Mention templates and macros

The enhanced @ mentions system transforms how users interact with the AI, making it more natural, powerful, and efficient to reference any resource or trigger any action within their workspace.