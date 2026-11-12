/* FreelaMZ — Sobre a aplicação, autor e processo de construção */
import { navbar } from '../js/layout.js';

const VERSAO = '1.0.0';
const AUTOR = 'Clávio Alfredo Chitsulete';

export default function sobre(props, { $h }) {
  return () => $h`
    <div class="page">
      ${navbar($h, { titulo: 'Sobre', voltar: true })}
      <div class="page-content">
        <div class="mz-container" style="max-width:620px;">

          <!-- Identidade -->
          <div class="mz-card" style="padding:26px; text-align:center;">
            <div class="sobre-logo">✨</div>
            <div class="fl-name" style="font-size:22px;">FreelaMZ</div>
            <div class="fl-title">Marketplace de talentos moçambicanos</div>
            <div class="mz-badge badge-aceita" style="display:inline-flex; margin-top:10px;">Versão ${VERSAO}</div>
            <p style="margin:16px 0 0 0; color:var(--mz-text-2); font-size:14px; line-height:1.6;">
              Liga clientes a freelancers em Moçambique: serviços, propostas, projetos,
              mensagens, carteira e avaliações — tudo num só lugar.
            </p>
          </div>

          <!-- Autor -->
          <div class="section-title">Autor</div>
          <div class="mz-card" style="padding:22px; display:flex; gap:14px; align-items:center;">
            <div class="sobre-logo sobre-logo-sm">👨🏾‍💻</div>
            <div>
              <div class="fl-name">${AUTOR}</div>
              <div class="fl-title">Idealizador e programador</div>
              <a href="mailto:claviochitsulete@gmail.com" style="font-size:13px; font-weight:700; color:var(--mz-primary); text-decoration:none;">
                claviochitsulete@gmail.com
              </a>
            </div>
          </div>

          <!-- Processo -->
          <div class="section-title">Como nasceu</div>
          <div class="mz-card" style="padding:22px;">
            <p class="sobre-p">
              O FreelaMZ começou como uma ideia simples: em Moçambique há muito talento
              (programadores, designers, redatores, fotógrafos) e muitos negócios que precisam
              dele, mas quase sempre se encontram apenas por indicação ou grupos de WhatsApp.
            </p>
            <p class="sobre-p">
              O primeiro passo foi desenhar o fluxo real de trabalho: o freelancer publica um
              serviço, o cliente envia uma proposta, combina-se o preço, entrega-se o trabalho e,
              no fim, fica uma avaliação. Tudo o que a plataforma faz nasceu desse percurso.
            </p>
            <p class="sobre-p">
              Depois veio o código: a interface foi construída em <strong>React</strong> com
              <strong>Framework7</strong> (aspecto de app nativa), a API em <strong>Node.js +
              Express</strong> e a base de dados em <strong>MySQL</strong>. O backend está
              publicado no <strong>Railway</strong> e a app Android é gerada automaticamente no
              <strong>GitHub Actions</strong>, sem precisar de Android Studio.
            </p>
            <p class="sobre-p">
              Durante o processo houve problemas reais: variáveis de ambiente em falta, base de
              dados inacessível no arranque, acentos estragados pelo terminal, páginas que exigiam
              login sem motivo. Cada um foi corrigido e testado com verificações automáticas
              (130 testes de API) e testes no próprio telemóvel, com dados móveis.
            </p>
            <p class="sobre-p" style="margin-bottom:0;">
              Esta versão é um ponto de partida: pagamentos reais (M-Pesa/e-Mola), notificações
              push e publicação na Play Store são os próximos passos.
            </p>
          </div>

          <!-- Tecnologia -->
          <div class="section-title">Tecnologia</div>
          <div class="mz-list-card">
            ${[
              ['phone_2', 'App', 'React + Framework7 + Capacitor (Android)'],
              ['server_rack', 'API', 'Node.js + Express'],
              ['cylinder_split_1x2', 'Base de dados', 'MySQL (Railway)'],
              ['cloud', 'Publicação', 'Railway + GitHub Actions'],
            ].map(([icone, titulo, sub]) => $h`
              <div class="mz-list-item">
                <div class="notif-icon-box" style="background:var(--grad-primary); width:38px; height:38px; min-width:38px; border-radius:12px; font-size:17px;">
                  <i class="f7-icons">${icone}</i>
                </div>
                <div class="mz-list-main">
                  <div class="mz-list-title">${titulo}</div>
                  <div class="mz-list-sub">${sub}</div>
                </div>
              </div>
            `)}
          </div>

          <!-- Créditos -->
          <div class="section-title">Créditos</div>
          <div class="mz-card" style="padding:18px; text-align:center;">
            <div style="font-size:13px; color:var(--mz-text-2); line-height:1.7;">
              Concebido, desenhado e programado por<br />
              <strong style="color:var(--mz-navy); font-size:15px;">${AUTOR}</strong><br />
              Maputo, Moçambique · ${new Date().getFullYear()}
            </div>
          </div>

          <div style="height:26px;"></div>
        </div>
      </div>
    </div>
  `;
}
