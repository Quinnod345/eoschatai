# What's New Features Framework

A comprehensive system for showcasing new features to users in your AI chatbot application.

## 🚀 Features

- **Automatic Detection**: Shows new features to users who haven't seen them
- **Beautiful UI**: Modern, animated modal with two-panel design
- **User Tracking**: Remembers what each user has seen (database + localStorage for guests)
- **Category Organization**: Features organized by type (Core, Productivity, Integration, etc.)
- **Manual Access**: Users can access via sidebar menu at any time
- **Badge Notifications**: Shows count of unseen features in sidebar

## 📁 File Structure

```
/lib/features/
  ├── config.ts                    # Feature definitions and configuration
/components/
  ├── whats-new-modal.tsx         # Main modal component
  ├── features-provider.tsx       # Context provider for features
/hooks/
  ├── use-features.ts             # Hook for managing feature state
/lib/db/migrations/
  ├── add_features_last_seen.sql  # Database migration
```

## 🛠️ Setup Instructions

### 1. Apply Database Migration

Run the migration to add user tracking:

```bash
# Apply the migration
pnpm db:migrate

# Or manually run the SQL:
# ALTER TABLE "User" ADD COLUMN "lastFeaturesVersion" timestamp;
```

### 2. Feature Configuration

Edit `/lib/features/config.ts` to add/modify features:

```typescript
{
  id: 'unique-feature-id',
  title: 'Feature Name',
  description: 'Brief description of what this feature does',
  category: 'productivity', // core, productivity, integration, advanced, eos
  version: '2.1',
  releaseDate: '2024-12-15',
  isNew: true, // Set to true for new features
  isPremium: false, // Optional: mark as premium feature
  icon: 'Zap', // Lucide icon name
  benefits: [
    'Key benefit 1',
    'Key benefit 2',
    'Key benefit 3'
  ],
  learnMoreUrl: 'https://docs.example.com/feature' // Optional
}
```

### 3. Available Icon Names

Use any of these Lucide React icon names:
- `MessageSquare`, `FileCode`, `FileText`, `Users`
- `Calendar`, `Search`, `Bookmark`, `AtSign`
- `Globe`, `Target`, `Upload`, `Keyboard`
- `Zap`, `Link`, `Settings`, `Sparkles`

### 4. Category Colors

Each category has a predefined color:
- **Core**: `bg-blue-500`
- **Productivity**: `bg-purple-500`
- **Integration**: `bg-green-500`
- **Advanced**: `bg-orange-500`
- **EOS**: `bg-red-500`

## 🎯 Usage

### Automatic Display

The modal automatically appears for:
- New users (first visit)
- Existing users when new features are added
- Users who haven't seen features since their `lastFeaturesVersion`

### Manual Access

Users can access the modal via:
- Sidebar user dropdown → "What's New" (shows badge if new features available)
- Direct programmatic access using the `useFeatures` hook

### Guest Support

For non-authenticated users:
- Uses `localStorage` to track seen features
- Graceful fallback when database isn't available
- Full functionality maintained

## 🔧 Hook Usage

```typescript
import { useFeatures } from '@/hooks/use-features';

function MyComponent() {
  const {
    hasNewFeatures,      // boolean: are there unseen features?
    newFeaturesCount,    // number: count of unseen features
    showModal,           // function: manually show modal
    hideModal,           // function: manually hide modal
    isModalOpen,         // boolean: is modal currently open?
    markAsSeen,          // function: mark features as seen
  } = useFeatures({
    userId: user?.id,    // optional: user ID for tracking
    autoShow: true       // optional: auto-show on new features
  });

  return (
    <div>
      {hasNewFeatures && (
        <button onClick={showModal}>
          See {newFeaturesCount} new features!
        </button>
      )}
    </div>
  );
}
```

## 📝 Adding New Features

1. **Add to config**: Update `/lib/features/config.ts` with new feature
2. **Set isNew: true**: Mark the feature as new
3. **Set release date**: Use current date for proper tracking
4. **Choose appropriate category**: Select the best fit category
5. **Add benefits**: List key benefits users will gain

Example:
```typescript
{
  id: 'ai-powered-search',
  title: 'AI-Powered Search',
  description: 'Find information faster with intelligent search suggestions',
  category: 'productivity',
  version: '2.1',
  releaseDate: '2024-12-15',
  isNew: true,
  icon: 'Search',
  benefits: [
    'Instant semantic search across all conversations',
    'Smart query suggestions',
    'Context-aware results',
    'Natural language queries'
  ]
}
```

## 🎨 Customization

### Modal Styling

The modal uses Tailwind CSS and can be customized via:
- Component props
- CSS classes in the component
- Theme provider for colors

### Animation Settings

Animations use Framer Motion and can be adjusted in the component:
```typescript
const springTransition = {
  type: 'spring',
  stiffness: 260,
  damping: 20,
  mass: 1,
};
```

### Auto-show Timing

Adjust the auto-show delay in `useFeatures.ts`:
```typescript
const timer = setTimeout(() => {
  setIsModalOpen(true);
}, 1000); // 1 second delay
```

## 🔄 Version Management

The system tracks features by date/version:
- `lastFeaturesVersion`: timestamp of when user last saw features
- `releaseDate`: when each feature was released
- Comparison determines which features are "new" for each user

## 🚨 Important Notes

1. **Database Migration**: Must be applied before using the feature tracking
2. **Feature IDs**: Must be unique across all features
3. **Release Dates**: Should be in chronological order for proper "new" detection
4. **Icons**: Must match available Lucide React icon names
5. **Performance**: Features are loaded once and cached for session

## 🛡️ Error Handling

The system gracefully handles:
- Missing database connections (falls back to localStorage)
- Invalid feature configurations
- Missing icons (falls back to Sparkles)
- Network errors during tracking updates

## 📱 Mobile Support

The modal is fully responsive and optimized for:
- Touch interactions
- Mobile screen sizes
- Proper scrolling behavior
- Accessibility features

## 🔍 Testing

To test the framework:

1. **Clear localStorage**: Remove `lastFeaturesVersion` to simulate new user
2. **Set isNew: true**: Mark features as new in config
3. **Adjust release dates**: Set recent dates to trigger "new" status
4. **Test both modes**: Try authenticated and guest users

## 🎯 Best Practices

1. **Feature Descriptions**: Keep concise but informative
2. **Benefits**: Focus on user value, not technical details
3. **Release Timing**: Batch related features in the same release
4. **Category Assignment**: Choose the most relevant category
5. **Icon Selection**: Use intuitive icons that represent the feature
6. **Version Management**: Use semantic versioning (e.g., 2.1, 2.2)

This framework provides a scalable, user-friendly way to introduce new features and keep users engaged with your application's evolving capabilities!