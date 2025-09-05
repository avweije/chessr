<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250831105345 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE evaluations.evaluation (id SERIAL NOT NULL, fen_id INT NOT NULL, move VARCHAR(10) NOT NULL, score INT NOT NULL, rank SMALLINT NOT NULL, depth SMALLINT NOT NULL, knodes INT DEFAULT NULL, fidx SMALLINT DEFAULT NULL, bytes BIGINT DEFAULT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX idx_evaluation_fen ON evaluations.evaluation (fen_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_fen_rank ON evaluations.evaluation (fen_id, rank)');
        $this->addSql('CREATE TABLE public.fen (id SERIAL NOT NULL, fen VARCHAR(255) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_3E71050E19BBD3D ON public.fen (fen)');
        $this->addSql('CREATE INDEX idx_fen_fen ON public.fen (fen)');
        $this->addSql('CREATE TABLE move_stats (fen_id INT NOT NULL, wins INT NOT NULL, draws INT NOT NULL, losses INT NOT NULL, PRIMARY KEY(fen_id))');
        $this->addSql('ALTER TABLE evaluations.evaluation ADD CONSTRAINT FK_1A6DA307C4429CB FOREIGN KEY (fen_id) REFERENCES public.fen (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE move_stats ADD CONSTRAINT FK_9B4578037C4429CB FOREIGN KEY (fen_id) REFERENCES public.fen (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE evaluations.evaluation DROP CONSTRAINT FK_1A6DA307C4429CB');
        $this->addSql('ALTER TABLE move_stats DROP CONSTRAINT FK_9B4578037C4429CB');
        $this->addSql('DROP TABLE evaluations.evaluation');
        $this->addSql('DROP TABLE public.fen');
        $this->addSql('DROP TABLE move_stats');
    }
}
