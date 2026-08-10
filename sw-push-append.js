/* =========================================================
   OPERATION CLINIC — WEB PUSH
   APPEND THIS TO THE VERY BOTTOM OF YOUR EXISTING sw.js
========================================================= */

self.addEventListener(
  'push',
  event=>{

    let data={};


    try {

      data=
        event.data
          ? event.data.json()
          : {};

    }
    catch(error) {

      data={
        title:
          'Clinic notification',

        body:
          event.data?.text()
          || ''
      };
    }


    const icon =
      new URL(
        'assets/alaa-clinic-logo.png',
        self.registration.scope
      ).href;


    const title =
      data.title
      ||
      'Clinic notification';


    const options = {

      body:
        data.body
        || '',

      icon,

      badge:
        icon,

      tag:
        data.tag
        || undefined,

      renotify:
        true,

      data:{

        url:
          data.url
          ||
          'app.html',

        appointmentId:
          data.appointmentId
          ||
          null
      }
    };


    event.waitUntil(

      self.registration
        .showNotification(
          title,
          options
        )

    );
  }
);



self.addEventListener(
  'notificationclick',
  event=>{

    event.notification.close();


    const relativeUrl =
      event.notification
        .data?.url
      ||
      'app.html';


    const targetUrl =
      new URL(
        relativeUrl,
        self.registration.scope
      ).href;


    event.waitUntil(

      clients
        .matchAll({
          type:'window',
          includeUncontrolled:true
        })
        .then(
          async windowClients=>{

            for (
              const client
              of windowClients
            ) {

              if (
                'navigate' in client
              ) {

                try {

                  await client.navigate(
                    targetUrl
                  );

                }
                catch(error) {
                  console.warn(
                    'Could not navigate existing clinic window',
                    error
                  );
                }


                return client.focus();
              }
            }


            return clients.openWindow(
              targetUrl
            );
          }
        )

    );
  }
);
