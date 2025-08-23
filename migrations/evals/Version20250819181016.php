<?php

declare(strict_types=1);

namespace DoctrineMigrationsEvals;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250819181016 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP SEQUENCE evaluations.evaluation_id_seq CASCADE');
        $this->addSql('DROP TABLE evaluations.evaluation');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE SCHEMA public');
        $this->addSql('CREATE SCHEMA evaluations');
        $this->addSql('CREATE SEQUENCE evaluations.evaluation_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE evaluations.evaluation (id INT NOT NULL, fen VARCHAR(255) NOT NULL, evals VARCHAR(8192) NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX idx_evaluation_fen ON evaluations.evaluation (fen)');
    }
}
