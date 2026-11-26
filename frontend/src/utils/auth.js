// 서버가 세션을 거부한 경우에만 토스 인증을 갱신한다.
export async function refreshAuthUser(api, login) {
  try {
    return await api.getUser();
  } catch (error) {
    if (error.status === 401) {
      try {
        return await login();
      } catch (loginError) {
        throw Object.assign(loginError, { status: 401 });
      }
    }
    throw error;
  }
}
