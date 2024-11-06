<?php

declare(strict_types=1);

namespace main;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20241101085429 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE opponent ADD parent_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE opponent ADD CONSTRAINT FK_A9322AFF727ACA70 FOREIGN KEY (parent_id) REFERENCES opponent (id)');
        $this->addSql('CREATE INDEX IDX_A9322AFF727ACA70 ON opponent (parent_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE opponent DROP FOREIGN KEY FK_A9322AFF727ACA70');
        $this->addSql('DROP INDEX IDX_A9322AFF727ACA70 ON opponent');
        $this->addSql('ALTER TABLE opponent DROP parent_id');
    }
}
