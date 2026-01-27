# Tutorial Seen Implementation Notes

## ✅ Completed Implementation

### Database Migration

**Migration File**: `supabase/migrations/016_add_tutorial_complete.sql` (updated to verify `tutorial_seen`)

**Status**:
- ✅ `tutorial_seen` column already exists from `003_add_tutorial_seen.sql`
- ✅ Migration 016 now verifies the column exists and RLS policies
- ✅ Schema: `profiles.id` (UUID) = `auth.users.id` (primary key, FK)
- ✅ RLS policies (from `002_rls_policies.sql`):
  - SELECT: `auth.uid() = id`
  - UPDATE: `auth.uid() = id`
  - INSERT: `auth.uid() = id`

### App Changes

#### 1. Tutorial Screen - Set `tutorial_seen = TRUE` on Continue

**File**: `frontend/src/screens/Tutorial.tsx`

**Implementation**:
- ✅ Added `markTutorialSeen()` function that sets `tutorial_seen = TRUE`
- ✅ Called ONLY when user clicks "Continue" button (not on Skip)
- ✅ Uses `profiles.id = user.id` (where `user.id` = `auth.uid()`)
- ✅ Error handling: Logs Supabase errors in dev mode, shows toast if needed
- ✅ Does NOT block navigation on error (proceeds anyway)
- ✅ Enhanced error logging in dev mode with full error details

**Code Pattern**:
```typescript
const markTutorialSeen = async () => {
  if (!user?.id) return;
  
  const { error } = await supabase
    .from('profiles')
    .update({ tutorial_seen: true })
    .eq('id', user.id); // profiles.id = auth.users.id
};
```

#### 2. Navigation Logic - Skip Tutorial If `tutorial_seen = TRUE`

**Files Updated**:
- `frontend/src/App.tsx` - Added `TutorialRoute` component
- `frontend/src/screens/Login.tsx` - Checks `tutorial_seen` after login

**Implementation**:
- ✅ `TutorialRoute` component checks `tutorial_seen` before showing tutorial
- ✅ Uses profile from `useAuth` hook if already loaded (avoids extra query)
- ✅ Falls back to direct query if profile not loaded
- ✅ If `tutorial_seen = true`, redirects to `/main` using `navigate('/main', { replace: true })`
- ✅ Shows loading state while checking (prevents flicker)
- ✅ Login screen also checks `tutorial_seen` and navigates accordingly

**Navigation Flow**:
1. User logs in → Login checks `tutorial_seen`
   - If `true` → Navigate to `/main`
   - If `false` → Navigate to `/tutorial`
2. User navigates to `/tutorial` directly → `TutorialRoute` checks flag
   - If `true` → Redirects to `/main`
   - If `false` → Shows tutorial
3. User clicks "Continue" → Sets `tutorial_seen = true` → Navigates to `/draw-geofence`
4. User clicks "Skip" → Does NOT set `tutorial_seen` → Navigates to `/main` (user can see tutorial again)

## Files Modified

1. **`supabase/migrations/016_add_tutorial_complete.sql`** (UPDATED)
   - Changed to verify `tutorial_seen` column exists
   - Verifies RLS policies are in place

2. **`frontend/src/hooks/useAuth.ts`**
   - Updated `Profile` interface to use `tutorial_seen` (removed `tutorial_complete`)
   - Removed logout reset logic (not requested)
   - Profile creation uses default `tutorial_seen = false`

3. **`frontend/src/screens/Tutorial.tsx`**
   - Added `markTutorialSeen()` function
   - Updated "Continue" button to call `markTutorialSeen()`
   - "Skip" button does NOT mark tutorial as seen
   - Enhanced error logging in dev mode

4. **`frontend/src/screens/Login.tsx`**
   - Updated to check `tutorial_seen` instead of `tutorial_complete`
   - Navigation: `tutorial_seen = true` → `/main`, else → `/tutorial`

5. **`frontend/src/App.tsx`**
   - Updated `TutorialRoute` to check `tutorial_seen` instead of `tutorial_complete`
   - Shows loading state while checking (prevents flicker)

## Key Assumptions

1. **Profile Identifier**: `profiles.id` = `auth.users.id` (primary key, FK)
   - Confirmed from `001_initial_schema.sql`: `id UUID PRIMARY KEY REFERENCES auth.users(id)`
   - All queries use `.eq('id', user.id)` where `user.id` = `auth.uid()`

2. **RLS Enforcement**: 
   - Policies already exist from `002_rls_policies.sql`
   - All updates use `user.id` from authenticated session
   - RLS enforces `auth.uid() = id` for all operations

3. **Tutorial Behavior**:
   - Only "Continue" button sets `tutorial_seen = true`
   - "Skip" button does NOT mark tutorial as seen (user can see it again)
   - This matches the requirement: "when the user clicks the Continue button"

4. **Error Handling**:
   - Errors are logged but don't block navigation
   - Enhanced logging in dev mode for debugging
   - Toast shown in dev mode if update fails

## Preventing Navigation Flicker

**Strategy**:
1. **Loading State**: `TutorialRoute` shows "Loading..." while checking `tutorial_seen`
2. **Profile Caching**: Uses `profile` from `useAuth` hook if already loaded
3. **Single Check**: Only checks once on mount, not on every render
4. **Replace Navigation**: Uses `navigate('/main', { replace: true })` to avoid history stack

## Testing Checklist

- [ ] New user signup: Goes to tutorial, `tutorial_seen = false`
- [ ] User clicks Continue: `tutorial_seen = true`, navigates to `/draw-geofence`
- [ ] User clicks Skip: `tutorial_seen` remains `false`, navigates to `/main`
- [ ] User logs in with `tutorial_seen = true`: Skips tutorial, goes to `/main`
- [ ] User navigates to `/tutorial` with `tutorial_seen = true`: Redirects to `/main`
- [ ] No flicker: Loading state shown while checking tutorial status
- [ ] RLS security: User cannot update another user's `tutorial_seen`
- [ ] Error handling: Update failure doesn't block navigation

## Migration Order

Run migrations in this order:
1. `001_initial_schema.sql` - Creates profiles table
2. `002_rls_policies.sql` - Creates RLS policies
3. `003_add_tutorial_seen.sql` - Adds tutorial_seen column
4. `016_add_tutorial_complete.sql` - **UPDATED** - Verifies tutorial_seen and RLS

## Notes

- **Column Name**: Using `tutorial_seen` (not `tutorial_complete`) as requested
- **Continue Only**: Only "Continue" button sets the flag, not "Skip"
- **No Logout Reset**: Logout does NOT reset `tutorial_seen` (not requested)
- **Backward Compatible**: All changes work with existing `tutorial_seen` column
