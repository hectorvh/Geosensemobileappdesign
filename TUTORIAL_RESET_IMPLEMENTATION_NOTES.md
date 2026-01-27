# Tutorial Reset Implementation Notes

## ✅ Completed Implementation

### Task 1: Reset `tutorial_seen` on Logout

**File**: `frontend/src/screens/Settings.tsx`

**Implementation**:
- ✅ Updated `handleLogout` to reset `tutorial_seen = FALSE` before calling `signOut()`
- ✅ Uses `profiles.id = user.id` where `user.id` = `auth.uid()`
- ✅ Error handling: Logs errors but does NOT block logout
- ✅ Proceeds with logout regardless of update result (ensures logout always works)

**Code Pattern**:
```typescript
const handleLogout = async () => {
  if (confirm('Are you sure you want to log out?')) {
    // Reset tutorial_seen to FALSE before logout
    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ tutorial_seen: false })
          .eq('id', user.id); // RLS enforces auth.uid() = id
      } catch (err) {
        // Log but don't block logout
        console.error('Error resetting tutorial_seen on logout:', err);
      }
    }
    
    // Proceed with logout regardless of update result
    await signOut();
    navigate('/');
  }
};
```

### Task 2: Reset `tutorial_seen` when "Tutorial" Button is Clicked

**File**: `frontend/src/screens/Settings.tsx`

**Implementation**:
- ✅ Updated Tutorial button `onClick` handler to reset `tutorial_seen = FALSE` before navigating
- ✅ Uses `profiles.id = user.id` where `user.id` = `auth.uid()`
- ✅ Error handling: Logs errors but still navigates (optimistic navigation)
- ✅ After update (or on error), navigates to `/tutorial` screen

**Code Pattern**:
```typescript
onClick={async () => {
  // Reset tutorial_seen to FALSE so user can see tutorial again
  if (user?.id) {
    try {
      await supabase
        .from('profiles')
        .update({ tutorial_seen: false })
        .eq('id', user.id); // RLS enforces auth.uid() = id
    } catch (err) {
      // Log but still navigate
      console.error('Error resetting tutorial_seen:', err);
    }
  }
  // Navigate to tutorial (optimistically, even if update fails)
  navigate('/tutorial');
}}
```

### Task 3: Security & Data Integrity

**RLS Enforcement**:
- ✅ All updates use `user.id` from authenticated session (`auth.uid()`)
- ✅ RLS policies (from `002_rls_policies.sql`) enforce `auth.uid() = id` for UPDATE operations
- ✅ Users can only update their own profile row
- ✅ No duplicate profile rows created (updates existing row)

**Schema Confirmation**:
- `profiles.id` (UUID) = `auth.users.id` (primary key, FK)
- Column: `tutorial_seen` BOOLEAN NOT NULL DEFAULT false
- RLS policies ensure users can only update their own profile

## Files Modified

1. **`frontend/src/screens/Settings.tsx`**
   - Added `supabase` import
   - Updated `handleLogout` to reset `tutorial_seen = FALSE` before logout
   - Updated Tutorial button handler to reset `tutorial_seen = FALSE` before navigation

## Ensuring Non-Breaking Behavior

### Logout Flow Protection

**Strategy**:
1. **Try-Catch Wrapper**: Update is wrapped in try-catch, errors are logged but don't throw
2. **Non-Blocking**: Logout proceeds even if update fails
3. **User ID Check**: Only attempts update if `user?.id` exists
4. **Graceful Degradation**: If update fails, logout still works normally

**Flow**:
```
User clicks Logout
  ↓
Confirm dialog
  ↓
Attempt to reset tutorial_seen = FALSE (non-blocking)
  ↓
Proceed with signOut() regardless of update result
  ↓
Navigate to '/' (login screen)
```

### Tutorial Button Flow Protection

**Strategy**:
1. **Optimistic Navigation**: Navigates to tutorial even if update fails
2. **Try-Catch Wrapper**: Update is wrapped in try-catch, errors are logged but don't throw
3. **User ID Check**: Only attempts update if `user?.id` exists
4. **User Experience**: User can still access tutorial even if update fails

**Flow**:
```
User clicks Tutorial button
  ↓
Attempt to reset tutorial_seen = FALSE (non-blocking)
  ↓
Navigate to '/tutorial' (optimistically)
  ↓
TutorialRoute checks tutorial_seen
  ↓
If FALSE → Shows tutorial
If TRUE → Redirects to /main (but we just set it to FALSE, so should show)
```

## Testing Checklist

- [ ] User logs out from Settings: `tutorial_seen` reset to `FALSE`, logout completes successfully
- [ ] User clicks Tutorial button: `tutorial_seen` reset to `FALSE`, navigates to tutorial
- [ ] Logout with network error: Logout still completes, error logged
- [ ] Tutorial button with network error: Still navigates to tutorial, error logged
- [ ] RLS security: User cannot update another user's `tutorial_seen`
- [ ] No navigation flicker: Navigation happens smoothly
- [ ] After logout and re-login: Tutorial is shown again (tutorial_seen = FALSE)
- [ ] After clicking Tutorial button: Tutorial screen is shown (tutorial_seen = FALSE)

## Notes

- **Non-Blocking Updates**: Both reset operations are non-blocking to ensure user flows are never interrupted
- **Error Handling**: Errors are logged for debugging but don't prevent navigation/logout
- **RLS Safety**: All updates use authenticated user ID, RLS enforces ownership
- **Optimistic Navigation**: Tutorial button navigates optimistically even if update fails
- **User Experience**: Users can always logout and access tutorial, even with network issues
