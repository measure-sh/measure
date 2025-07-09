enum HttpMethod {
  get,
  post,
  put,
  delete,
  patch,
  unknown;

  static HttpMethod fromString(String value) {
    switch (value.toLowerCase()) {
      case 'get':
        return HttpMethod.get;
      case 'post':
        return HttpMethod.post;
      case 'put':
        return HttpMethod.put;
      case 'delete':
        return HttpMethod.delete;
      case 'patch':
        return HttpMethod.patch;
      default:
        return HttpMethod.unknown;
    }
  }
}

