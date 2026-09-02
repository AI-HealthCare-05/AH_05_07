const PRODUCTION_ORIGIN = "https://ah-05-07-pages.ahnsangkyoon.workers.dev";

export default {
  fetch(request) {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    destination.host = new URL(PRODUCTION_ORIGIN).host;

    return Response.redirect(destination, 308);
  },
};
