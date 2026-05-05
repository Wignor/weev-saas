export const metadata = {
  title: 'Política de Privacidade — WeevTrack',
  description: 'Política de Privacidade do aplicativo WeevTrack',
};

export default function PrivacidadePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Política de Privacidade</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>WeevTrack — Rastreamento Veicular · Última atualização: maio de 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1. Introdução</h2>
        <p>A WeevTrack (&quot;nós&quot;, &quot;nosso&quot;) está comprometida com a proteção da sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos e protegemos as informações dos usuários do aplicativo WeevTrack.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2. Informações que coletamos</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}><strong>Dados de localização dos veículos:</strong> posição GPS, velocidade e histórico de trajetos dos dispositivos rastreadores cadastrados.</li>
          <li style={{ marginBottom: 8 }}><strong>Dados de conta:</strong> nome, endereço de e-mail e senha para autenticação na plataforma.</li>
          <li style={{ marginBottom: 8 }}><strong>Dados de uso:</strong> informações sobre como você utiliza o aplicativo, para melhoria contínua do serviço.</li>
          <li style={{ marginBottom: 8 }}><strong>Dados do dispositivo:</strong> identificador do aparelho, sistema operacional e versão do aplicativo.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3. Como usamos suas informações</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>Fornecer os serviços de rastreamento veicular em tempo real.</li>
          <li style={{ marginBottom: 8 }}>Enviar alertas e notificações relacionados aos veículos monitorados.</li>
          <li style={{ marginBottom: 8 }}>Autenticar e manter a segurança da sua conta.</li>
          <li style={{ marginBottom: 8 }}>Melhorar a plataforma com base no comportamento de uso.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4. Compartilhamento de dados</h2>
        <p>Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros para fins comerciais. Os dados podem ser compartilhados apenas:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 8 }}>Com prestadores de serviço que nos auxiliam na operação da plataforma (servidores, infraestrutura).</li>
          <li style={{ marginBottom: 8 }}>Quando exigido por lei ou ordem judicial.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>5. Armazenamento e segurança</h2>
        <p>Seus dados são armazenados em servidores seguros com criptografia. Adotamos medidas técnicas e organizacionais para proteger as informações contra acesso não autorizado, perda ou alteração.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>6. Câmera</h2>
        <p>O aplicativo pode solicitar acesso à câmera do dispositivo exclusivamente para leitura do código de barras IMEI ao cadastrar novos rastreadores. Nenhuma imagem é capturada, armazenada ou transmitida.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>7. Notificações push</h2>
        <p>Com sua autorização, enviamos notificações sobre eventos dos veículos (ignição, movimento, alertas). Você pode revogar essa permissão a qualquer momento nas configurações do dispositivo.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>8. Seus direitos (LGPD)</h2>
        <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 8 }}>Acessar os dados que temos sobre você.</li>
          <li style={{ marginBottom: 8 }}>Corrigir dados incorretos ou incompletos.</li>
          <li style={{ marginBottom: 8 }}>Solicitar a exclusão dos seus dados.</li>
          <li style={{ marginBottom: 8 }}>Revogar o consentimento para uso dos seus dados.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>9. Contato</h2>
        <p>Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato:</p>
        <p style={{ marginTop: 8 }}><strong>E-mail:</strong> contato@weevtrack.com</p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>10. Alterações nesta política</h2>
        <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas pelo aplicativo ou por e-mail. O uso continuado do serviço após as alterações implica aceitação da política atualizada.</p>
      </section>
    </div>
  );
}
