(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function esc(value){
    return C.escape(value ?? '');
  }


  async function teamMessages(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v37_team_chat_messages'
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function sendTeamMessage(
    body
  ){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v37_send_team_chat_message',
        {
          p_body:
            body
        }
      );


    if(error){
      throw error;
    }


    const messageId =
      Array.isArray(data)
        ? data[0]
        : data;


    if(messageId){

      C.sb.functions.invoke(
        'send-team-chat-push',
        {
          body:{
            message_id:
              messageId
          }
        }
      )
      .catch(
        error=>
          console.warn(
            'Team chat push failed',
            error
          )
      );
    }


    return messageId;
  }


  /*
   * Wrap V36 Messages list and inject Whole Clinic Team at the top.
   */
  const oldChatList =
    window.ClinicPages?.[
      'clinic-chat'
    ];


  if(
    typeof oldChatList ===
    'function'
  ){

    window.ClinicPages[
      'clinic-chat'
    ] =
      async function(params={}){

        const result =
          await oldChatList(
            params
          );


        const list =
          document.querySelector(
            '.v36-message-list'
          );


        if(
          list
          &&
          !document.getElementById(
            'v37TeamChatRow'
          )
        ){

          const row =
            document.createElement(
              'button'
            );


          row.id =
            'v37TeamChatRow';


          row.type =
            'button';


          row.className =
            'v36-message-row v37-team-chat-row';


          row.innerHTML = `
            <div class="v36-message-avatar v37-team-avatar">
              👥
            </div>

            <div class="v36-message-row-main">

              <div class="v36-message-name-row">
                <strong>
                  ${
                    C.lang==='ar'
                      ? 'فريق العيادة بالكامل'
                      : 'Whole clinic team'
                  }
                </strong>

                <span class="v37-team-badge">
                  ${
                    C.lang==='ar'
                      ? 'عام'
                      : 'TEAM'
                  }
                </span>
              </div>

              <p>
                ${
                  C.lang==='ar'
                    ? 'محادثة جماعية لكل أعضاء العيادة'
                    : 'Group conversation for everyone in the clinic'
                }
              </p>

            </div>

            <small>›</small>
          `;


          row.onclick =
            ()=>C.route(
              'clinic-team-chat'
            );


          list.insertAdjacentElement(
            'afterbegin',
            row
          );
        }


        return result;
      };
  }


  let timer =
    null;


  function stopTimer(){

    clearInterval(
      timer
    );


    timer =
      null;
  }


  window.ClinicPages[
    'clinic-team-chat'
  ] =
    async function(){

      stopTimer();


      C.setTitle(
        C.lang==='ar'
          ? 'فريق العيادة'
          : 'Whole clinic team'
      );


      const main =
        document.getElementById(
          'mainContent'
        );


      async function draw(){

        const rows =
          await teamMessages();


        main.innerHTML = `
          <section class="v37-team-thread">

            <header class="v37-team-thread-header">

              <button
                id="v37BackToMessages"
                type="button"
                class="v36-thread-back"
                aria-label="Back"
              >
                ←
              </button>


              <div class="v36-thread-avatar v37-team-avatar">
                👥
              </div>


              <div class="v36-thread-title">

                <strong>
                  ${
                    C.lang==='ar'
                      ? 'فريق العيادة بالكامل'
                      : 'Whole clinic team'
                  }
                </strong>

                <small>
                  ${
                    C.lang==='ar'
                      ? 'كل أعضاء العيادة'
                      : 'Everyone in the clinic'
                  }
                </small>

              </div>

            </header>


            <div
              id="v37TeamMessages"
              class="v37-team-messages"
            >

              ${
                rows.length
                  ? rows.map(
                      row=>`
                        <article
                          class="v37-team-bubble ${
                            row.sender_id ===
                            C.user.id
                              ? 'mine'
                              : 'theirs'
                          }"
                        >

                          ${
                            row.sender_id !==
                            C.user.id
                              ? `
                                  <strong>
                                    ${esc(
                                      row.sender_name
                                      ||
                                      'User'
                                    )}
                                  </strong>
                                `
                              : ''
                          }

                          <p>
                            ${esc(
                              row.body
                            )}
                          </p>

                          <small>
                            ${C.formatDate(
                              row.created_at,
                              {
                                hour:'2-digit',
                                minute:'2-digit'
                              }
                            )}
                          </small>

                        </article>
                      `
                    ).join('')
                  : `
                      <div class="empty-state">
                        ${
                          C.lang==='ar'
                            ? 'ابدأ أول رسالة لفريق العيادة.'
                            : 'Start the first team message.'
                        }
                      </div>
                    `
              }

            </div>


            <form
              id="v37TeamComposer"
              class="v37-team-composer"
            >

              <textarea
                id="v37TeamText"
                class="control"
                rows="2"
                maxlength="4000"
                placeholder="${
                  C.lang==='ar'
                    ? 'اكتب رسالة لكل فريق العيادة...'
                    : 'Write a message to the whole clinic team...'
                }"
                required
              ></textarea>

              <button
                type="submit"
                class="v36-send-button"
                aria-label="Send"
              >
                ➤
              </button>

            </form>

          </section>
        `;


        document
          .getElementById(
            'v37BackToMessages'
          )
          .onclick =
            ()=>C.route(
              'clinic-chat'
            );


        const list =
          document.getElementById(
            'v37TeamMessages'
          );


        if(list){

          list.scrollTop =
            list.scrollHeight;
        }


        document
          .getElementById(
            'v37TeamComposer'
          )
          .onsubmit =
            async event=>{

              event.preventDefault();


              const input =
                document.getElementById(
                  'v37TeamText'
                );


              const body =
                input.value.trim();


              if(!body){
                return;
              }


              try{

                await sendTeamMessage(
                  body
                );


                input.value =
                  '';


                await draw();

              }
              catch(error){

                C.toast(
                  error.message,
                  'error'
                );
              }
            };
      }


      try{

        await draw();

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(
              error.message
            )}
          </section>
        `;

        return;
      }


      timer =
        setInterval(
          async()=>{

            if(
              C.currentPage !==
              'clinic-team-chat'
            ){

              stopTimer();

              return;
            }


            const input =
              document.getElementById(
                'v37TeamText'
              );


            if(
              input?.matches(
                ':focus'
              )
              &&
              input.value
            ){
              return;
            }


            try{

              await draw();

            }
            catch(error){

              console.warn(
                'Team chat refresh failed',
                error
              );
            }

          },
          3500
        );
    };


  /*
   * MOBILE WIDTH PATCH
   * Make dedicated chat thread use the full usable mobile width.
   */
  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    .v37-team-chat-row {
      background:
        linear-gradient(
          90deg,
          #f0faf7,
          #ffffff
        );
      border-bottom:
        1px solid #bfe0d8 !important;
    }

    .v37-team-avatar {
      background: #d9f2ec !important;
    }

    .v37-team-badge {
      padding: 3px 6px;
      border-radius: 999px;
      background: #0f8b78;
      color: white;
      font-size: 8px;
      font-weight: 900;
    }

    .v37-team-thread {
      width: 100%;
      height: calc(100vh - 165px);
      min-height: 540px;
      display: grid;
      grid-template-rows:
        auto
        minmax(0,1fr)
        auto;
      border: 1px solid #dde5eb;
      border-radius: 14px;
      background: white;
      overflow: hidden;
    }

    .v37-team-thread-header {
      min-height: 72px;
      display: grid;
      grid-template-columns:
        auto
        auto
        minmax(0,1fr);
      gap: 11px;
      align-items: center;
      padding: 11px 16px;
      border-bottom: 1px solid #e4e9ee;
      background: white;
    }

    .v37-team-messages {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 18px 20px;
      background:
        linear-gradient(
          180deg,
          #f7f9fb 0%,
          #ffffff 100%
        );
    }

    .v37-team-bubble {
      width: fit-content;
      max-width: min(74%, 640px);
      padding: 9px 12px;
      border-radius: 17px;
      border: 1px solid #dfe5ea;
      background: white;
    }

    .v37-team-bubble.mine {
      align-self: flex-end;
      border-color: #b7dfd5;
      background: #dff5ef;
      border-bottom-right-radius: 5px;
    }

    .v37-team-bubble.theirs {
      align-self: flex-start;
      border-bottom-left-radius: 5px;
    }

    .v37-team-bubble strong {
      display: block;
      margin-bottom: 3px;
      color: #087260;
      font-size: 9px;
    }

    .v37-team-bubble p {
      margin: 0 0 3px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .v37-team-bubble small {
      display: block;
      color: #8792a1;
      font-size: 8px;
      text-align: end;
    }

    .v37-team-composer {
      display: grid;
      grid-template-columns:
        minmax(0,1fr)
        auto;
      gap: 8px;
      align-items: end;
      padding: 10px 14px;
      border-top: 1px solid #e3e8ed;
      background: white;
    }

    .v37-team-composer textarea {
      min-height: 46px;
      max-height: 120px;
      resize: vertical;
      border-radius: 18px !important;
    }


    /* =====================================================
       MOBILE: use all available screen width
       Applies to normal V36 thread and team V37 thread
    ===================================================== */
    @media (max-width: 760px) {

      body,
      #app,
      .app-shell,
      .main-area,
      #mainContent {
        max-width: 100vw !important;
      }

      #mainContent {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      .v36-thread-page,
      .v37-team-thread {
        width: 100vw !important;
        max-width: 100vw !important;
        height: calc(100dvh - 105px) !important;
        min-height: 0 !important;
        margin: 0 !important;
        border-left: 0 !important;
        border-right: 0 !important;
        border-radius: 0 !important;
      }

      .v36-thread-header,
      .v37-team-thread-header {
        padding:
          9px
          10px !important;
      }

      .v36-thread-messages,
      .v37-team-messages {
        padding:
          12px
          9px !important;
      }

      .v36-chat-bubble,
      .v37-team-bubble {
        max-width: 88% !important;
        font-size: 14px;
      }

      .v36-thread-composer,
      .v37-team-composer {
        padding:
          8px
          9px
          calc(
            8px
            +
            env(
              safe-area-inset-bottom
            )
          ) !important;
      }

      .v36-thread-composer textarea,
      .v37-team-composer textarea {
        width: 100% !important;
        min-width: 0 !important;
      }

      .v36-send-button {
        width: 44px !important;
        height: 44px !important;
        flex: 0 0 44px !important;
      }

      .v36-message-list {
        margin-left: 0 !important;
        margin-right: 0 !important;
        border-left: 0 !important;
        border-right: 0 !important;
        border-radius: 0 !important;
      }

      .v36-message-row {
        width: 100% !important;
        padding:
          11px
          9px !important;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();
