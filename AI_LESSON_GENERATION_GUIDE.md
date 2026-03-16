# AI Lesson Generation with Anthropic Claude

## Overview
This system allows admins to generate educational content using Anthropic's Claude API with three distinct modes:
1. **Single Lesson** - Standalone training content
2. **Course** - Multiple lessons forming a complete course
3. **Course Lesson** - Add lessons to an existing course

## Setup Instructions

### 1. Environment Variables
Add to your `.env.local`:
```bash
# Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 2. API Endpoint Created
**Location:** `/src/app/api/admin/ai/generate-lessons-anthropic/route.ts`

**Features:**
- Uses Anthropic Claude 3.5 Sonnet
- Supports Swahili and English
- Three difficulty levels: Beginner, Intermediate, Advanced
- Generates 1-20 lessons per request
- Contextually aware for course lessons
- Auto-saves to database when requested

**Request Format:**
```typescript
POST /api/admin/ai/generate-lessons-anthropic
{
  "topicPrompt": "Financial Basics — budgeting, saving, investing",
  "lessonCount": 5,
  "language": "sw", // or "en"
  "difficulty": "beginner", // or "intermediate", "advanced"
  "lessonType": "course", // or "single", "course_lesson"
  "courseId": 123, // Required only for "course_lesson" type
  "saveToCourse": false // Set true to auto-save
}
```

**Response Format:**
```typescript
{
  "success": true,
  "lessons": [
    {
      "title": "Lesson Title",
      "content": "Markdown formatted content...",
      "duration_minutes": 15,
      "language": "sw",
      "lesson_order": 1
    }
  ],
  "message": "Successfully generated 5 lesson(s)"
}
```

## UI Integration Plan

### Current State
You already have an AI lesson generator in the admin dashboard at:
- **File:** `/src/app/dashboard/page.tsx`
- **Lines:** 1688-1742
- **Current API:** Uses OpenAI (`/api/admin/ai/generate-lessons`)

### Recommended Updates

#### Option 1: Replace OpenAI with Anthropic
Update the `handleGenerateLessonsWithAI` function to call the new Anthropic endpoint:

```typescript
const handleGenerateLessonsWithAI = async (saveNow: boolean) => {
  if (!managingLessons?.id) return;
  setAiGenerating(!saveNow);
  setAiSaving(saveNow);
  setAiError(null);
  
  try {
    const res = await fetch('/api/admin/ai/generate-lessons-anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: managingLessons.id,
        topicPrompt: aiTopicPrompt,
        lessonCount: aiLessonCount,
        language: aiLanguage,
        difficulty: aiDifficulty,
        lessonType: 'course_lesson', // or make this selectable
        saveToCourse: saveNow,
      }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      setAiError(data.error || 'Failed to generate');
      return;
    }
    
    if (saveNow) {
      setAiGeneratedLessons(null);
      setShowAiLessonGenerator(false);
      // Refresh lessons list
      const refreshRes = await fetch(`/api/admin/educational-content/${managingLessons.id}/lessons`);
      if (refreshRes.ok) {
        const lessonsData = await refreshRes.json();
        setLessons(lessonsData);
      }
    } else {
      setAiGeneratedLessons(data.lessons);
    }
  } catch (e) {
    setAiError('Network error');
  } finally {
    setAiGenerating(false);
    setAiSaving(false);
  }
};
```

#### Option 2: Add Lesson Type Selector
Add a new state variable and UI control:

```typescript
// Add to state
const [aiLessonType, setAiLessonType] = useState<'single' | 'course' | 'course_lesson'>('course_lesson');

// Add to UI (in the AI generator section)
<div>
  <label className={dkLabel}>Aina ya Somo</label>
  <select 
    value={aiLessonType} 
    onChange={e => setAiLessonType(e.target.value as any)} 
    className={dkSelect}
  >
    <option value="single">Somo Moja (Single Lesson)</option>
    <option value="course">Kozi Kamili (Complete Course)</option>
    <option value="course_lesson">Ongeza kwa Kozi (Add to Course)</option>
  </select>
</div>
```

## Usage Scenarios

### Scenario 1: Generate Single Standalone Lesson
```javascript
{
  "topicPrompt": "How to create a business budget",
  "lessonCount": 1,
  "language": "en",
  "difficulty": "beginner",
  "lessonType": "single",
  "saveToCourse": false
}
```

### Scenario 2: Generate Complete Course
```javascript
{
  "topicPrompt": "Entrepreneurship fundamentals for small businesses in Tanzania",
  "lessonCount": 8,
  "language": "sw",
  "difficulty": "intermediate",
  "lessonType": "course",
  "saveToCourse": false // Preview first, then save manually
}
```

### Scenario 3: Add Lessons to Existing Course
```javascript
{
  "courseId": 5,
  "topicPrompt": "Advanced investment strategies",
  "lessonCount": 3,
  "language": "sw",
  "difficulty": "advanced",
  "lessonType": "course_lesson",
  "saveToCourse": true // Auto-save to course
}
```

## Benefits of Anthropic Claude

1. **Better Swahili Support** - Claude has excellent multilingual capabilities
2. **Longer Context** - Can handle more complex course structures
3. **Better Reasoning** - Creates more coherent lesson progressions
4. **Cultural Awareness** - Better understanding of Tanzanian context
5. **Structured Output** - More reliable JSON generation

## Cost Comparison

**Anthropic Claude 3.5 Sonnet:**
- Input: $3 per million tokens
- Output: $15 per million tokens
- Typical lesson generation: ~2,000 input + 3,000 output tokens
- Cost per 5-lesson course: ~$0.05

**OpenAI GPT-4o-mini:**
- Input: $0.15 per million tokens
- Output: $0.60 per million tokens
- Similar token usage
- Cost per 5-lesson course: ~$0.002

**Recommendation:** Claude provides better quality for educational content despite slightly higher cost.

## Next Steps

1. ✅ API endpoint created (`/api/admin/ai/generate-lessons-anthropic/route.ts`)
2. ⏳ Add `ANTHROPIC_API_KEY` to `.env.local`
3. ⏳ Update admin dashboard to use new endpoint
4. ⏳ Add lesson type selector UI
5. ⏳ Test with sample topics
6. ⏳ Deploy to production

## Testing

Test the endpoint directly:
```bash
curl -X POST http://localhost:3000/api/admin/ai/generate-lessons-anthropic \
  -H "Content-Type: application/json" \
  -d '{
    "topicPrompt": "Jinsi ya kuanzisha biashara ndogo",
    "lessonCount": 3,
    "language": "sw",
    "difficulty": "beginner",
    "lessonType": "single",
    "saveToCourse": false
  }'
```

## Troubleshooting

**Error: MISSING_ANTHROPIC_API_KEY**
- Add `ANTHROPIC_API_KEY` to `.env.local`
- Restart dev server

**Error: Failed to parse JSON**
- Claude occasionally returns malformed JSON
- Retry the request
- Consider adding retry logic

**Lessons too short/long**
- Adjust the system prompt in the API route
- Modify duration_minutes range
- Add more specific instructions in topicPrompt
