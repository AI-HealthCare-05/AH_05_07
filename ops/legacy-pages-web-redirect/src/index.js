const PRODUCTION_ORIGIN = "https://hyeol.app";

export default {
  fetch(request) {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    destination.host = new URL(PRODUCTION_ORIGIN).host;

    return Response.redirect(destination, 308);
  },
};
