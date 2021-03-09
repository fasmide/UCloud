package dk.sdu.cloud.mail.rpc

import dk.sdu.cloud.Role
import dk.sdu.cloud.mail.api.*
import dk.sdu.cloud.service.Controller
import dk.sdu.cloud.calls.server.RpcServer
import dk.sdu.cloud.calls.server.securityPrincipal
import dk.sdu.cloud.mail.services.MailService
import dk.sdu.cloud.service.Loggable
import mail.services.SettingsService

class MailController(
    private val mailService: MailService,
    private val settingsService: SettingsService,
) : Controller {
    override fun configure(rpcServer: RpcServer): Unit = with(rpcServer) {
        implement(MailDescriptions.send) {
            ok(mailService.send(ctx.securityPrincipal, request.receiver, request.mail, request.mandatory))
        }

        implement(MailDescriptions.sendSupport) {
            ok(mailService.sendSupportTicket(request.fromEmail, request.subject, request.message))
        }

        implement(MailDescriptions.sendBulk) {
            request.messages.forEach {
                val allowedToSend = mailService.allowedToSend(it.receiver)
                if (allowedToSend) {
                    mailService.send(ctx.securityPrincipal, it.receiver, it.mail, it.mandatory)
                }
            }
            ok(Unit)
        }

        implement(MailDescriptions.retrieveEmailSettings) {
            val user = if (ctx.securityPrincipal.role == Role.SERVICE) {
                request.username
            } else {
                ctx.securityPrincipal.username
            }
            ok(RetrieveEmailSettingsResponse(
                settingsService.getEmailSettings(request.username!!)
            ))
        }

        implement(MailDescriptions.toggleEmailSettings) {
            ok(Unit)
        }

        return@configure
    }

    companion object : Loggable {
        override val log = logger()
    }
}
