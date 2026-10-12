/** Сервер не відповів — замість порожньої сторінки кажемо, що робити. */
export function LoadError() {
  return (
    <main id="main" className="container checkout checkout--done">
      <section className="done">
        <h1>Не вдалося завантажити</h1>
        <p>Сервер зараз не відповідає. Спробуйте оновити сторінку за хвилинку.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
          Оновити сторінку
        </button>
      </section>
    </main>
  )
}
