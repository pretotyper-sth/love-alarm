// Restore existing sessions silently; requesting Toss login requires a user action.
export async function restoreAuthUser(api) {
  const savedUser = api.getCurrentUser();
  if (!savedUser || !api.hasSession()) return null;
  try {
    return await api.getUser();
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) {
      api.logout();
      return null;
    }
    return savedUser;
  }
}
