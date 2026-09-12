import { Button, TextField } from '@okinawa-care/ui/react';
import Icon from './Icon';

export default function ConsultationSearch({ query, onSearch }: { query: string; onSearch(query: string): void }) {
  return <form className="search-form" role="search" onSubmit={event => {
    event.preventDefault();
    onSearch(String(new FormData(event.currentTarget).get('query') ?? '').trim());
  }}>
    <div className="search-input">
      <Icon name="search" width="18" height="18" />
      <TextField compact id="consultation-search" name="query" label="お名前・仕事で検索" placeholder="お名前・仕事で検索" type="search" maxLength={100} defaultValue={query} />
    </div>
    <Button compact variant="outline" type="submit">検索</Button>
  </form>;
}
